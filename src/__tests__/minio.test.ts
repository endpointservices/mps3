import { PutObjectCommandInput, S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll, beforeEach } from "bun:test";
import { MPS3, uuidRegex } from "mps3";

describe("mps3", () => {
  let mps3: MPS3;

  beforeAll(async () => {
    const s3 = new S3({
      region: "us-east-1",
      endpoint: "http://127.0.0.1:9000 ", // for docker, http://minio:9000
      credentials: {
        accessKeyId: "mps3",
        secretAccessKey: "ZOAmumEzdsUUcVlQ",
      },
      forcePathStyle: true,
      //logger: console,
    });

    try {
      console.log("creating bucket");
      await s3.createBucket({
        Bucket: "test5",
      });
    } catch (e) {}

    try {
      console.log("enable version");
      await s3.putBucketVersioning({
        Bucket: "test5",
        VersioningConfiguration: {
          Status: "Enabled",
        },
      });

      let status = undefined;
      while (status !== "Enabled") {
        status = (await s3.getBucketVersioning({ Bucket: "test5" })).Status;
      }
    } catch (e) {
      console.error(e);
    }
    mps3 = new MPS3({
      defaultBucket: "test5",
      api: s3,
    });
  });

  test("Version test", async () => {
    const command: PutObjectCommandInput = {
      Bucket: "test5",
      Key: "key",
      ContentType: "application/json",
      Body: "cool",
    };

    const fileUpdate = await mps3.config.api.putObject(command);
    expect(fileUpdate.VersionId).toMatch(uuidRegex);
  });

  test("Can read your write (number)", async () => {
    const rnd = Math.random();
    await mps3.put("test5", rnd);
    const read = await mps3.get("test5");
    expect(read).toEqual(rnd);
  });

  test("Can read your write (number)", async () => {
    const rnd = Math.random();
    await mps3.put("test5", rnd, {
      manifests: [],
    });
    const read = await mps3.get("test5");
    expect(read).toEqual(rnd);
  });

  test("Subscribe to changes", async (done) => {
    const rnd = Math.random();
    await mps3.subscribe("sub", (value) => {
      expect(value).toEqual(rnd);
      done();
    });
    mps3.put("sub", rnd);
  });
});
