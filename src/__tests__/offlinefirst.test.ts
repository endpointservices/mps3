import { S3 } from "@aws-sdk/client-s3";
import {
  expect,
  test,
  describe,
  beforeAll,
  beforeEach,
  afterEach,
} from "bun:test";
import { MPS3, MPS3Config } from "mps3";
import { DOMParser } from "@xmldom/xmldom";
import { uuid } from "types";
import "fake-indexeddb/auto";

describe("mps3", () => {
  let s3: S3;
  let session = uuid().substring(32);
  const stableConfig = {
    endpoint: "http://127.0.0.1:9102",
    region: "eu-central-1",
    credentials: {
      accessKeyId: "mps3",
      secretAccessKey: "ZOAmumEzdsUUcVlQ",
    },
  };

  const unstableConfig = {
    endpoint: "http://127.0.0.1:9104",
    region: "eu-central-1",
    credentials: {
      accessKeyId: "mps3",
      secretAccessKey: "ZOAmumEzdsUUcVlQ",
    },
  };

  const configs: {
    label: string;
    config: MPS3Config;
  }[] = [
    {
      label: "useVersioning",
      config: {
        pollFrequency: 100,
        useVersioning: true,
        defaultBucket: `ver${session}`,
        s3Config: unstableConfig,
        parser: new DOMParser(),
      },
    },
    {
      label: "noVersioning",
      config: {
        pollFrequency: 100,
        defaultBucket: `nov${session}`,
        s3Config: unstableConfig,
        parser: new DOMParser(),
      },
    },
  ];

  const setOnline = async (state: boolean) => {
    fetch("localhost:8474/proxies/minio", {
      method: "POST",
      body: JSON.stringify({
        enabled: state,
      }),
    });
  };

  configs.map((variant) =>
    describe(variant.label, () => {
      beforeAll(async () => {
        s3 = new S3(stableConfig);

        await s3.createBucket({
          Bucket: variant.config.defaultBucket,
        });

        if (variant.config.useVersioning) {
          await s3.putBucketVersioning({
            Bucket: variant.config.defaultBucket,
            VersioningConfiguration: {
              Status: "Enabled",
            },
          });
        }
      });

      beforeEach(async () => {
        await setOnline(true);
      });

      afterEach(async () => {
        await setOnline(true);
      });

      const getClient = (args?: { label?: string; online?: boolean }) =>
        new MPS3({
          label: args?.label,
          online: args?.online ?? true,
          ...variant.config,
        });

      test("Online client commits messages", async () => {
        const writer = getClient({
          online: true,
        });
        await writer.put("online", true);

        const reader = getClient({
          online: true,
        });
        expect(await reader.get("online")).toBe(true);
      });

      test("Offline client does not commit messages", async () => {
        const writer = getClient({
          online: false,
        });
        await writer.put("offline", true);

        const reader = getClient({
          label: "other",
          online: true,
        });
        expect(await reader.get("offline")).toBe(undefined);
      });

      test("Restored online client has populated cache", async () => {
        console.log("Setup writer");
        const writer = getClient({
          label: "restore-1",
          online: false,
        });
        await writer.put("restore-1", "foo");

        console.log("Restore");
        const restored = getClient({
          label: "restore-1",
          online: false,
        });
        // TODO kill this
        restored.getOrCreateManifest(restored.config.defaultManifest);

        await new Promise((resolve) => setTimeout(resolve, 200)); // TODO Problem with async here
        expect(await restored.get("restore-1")).toBe("foo");
      });
    })
  );
});
