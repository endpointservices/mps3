import { S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll, beforeEach } from "bun:test";
import { MPS3, MPS3Config } from "mps3";
import { ResolvedRef, uuid } from "types";
import { clone } from "json";
import { DOMParser } from "@xmldom/xmldom";
import cloudflareCredentials from "../../credentials/cloudflare.json";
import gcsCredentials from "../../credentials/gcs.json";
import awsCredentials from "../../credentials/aws.json";
import "fake-indexeddb/auto";

describe("mps3", () => {
  let session = uuid().substring(0, 8);
  const minioConfig = {
    endpoint: "http://127.0.0.1:9102",
    region: "eu-central-1",
    autoclean: false,
    credentials: {
      accessKeyId: "mps3",
      secretAccessKey: "ZOAmumEzdsUUcVlQ",
    },
  };

  const configs: {
    label: string;
    createBucket?: boolean;
    config: MPS3Config;
  }[] = [
    {
      label: "useVersioning",
      config: {
        pollFrequency: 100,
        useVersioning: true,
        defaultBucket: `ver${session}`,
        s3Config: minioConfig,
        parser: new DOMParser(),
      },
    },
    {
      label: "minio",
      config: {
        pollFrequency: 100,
        useChecksum: false,
        defaultBucket: `nov${session}`,
        s3Config: minioConfig,
        parser: new DOMParser(),
      },
    },
    {
      label: "localfirst",
      createBucket: false,
      config: {
        pollFrequency: 1,
        parser: new DOMParser(),
        defaultBucket: "l1",
        offlineStorage: false,
        adaptiveClock: false,
        s3Config: {
          endpoint: MPS3.LOCAL_ENDPOINT,
        },
      },
    },
    /*
    {
      label: "google",
      createBucket: false,
      config: {
        useChecksum: true,
        pollFrequency: 100,
        defaultBucket: `mps3-demo`,
        s3Config: {
          region: "europe-west10",
          endpoint: "https://storage.googleapis.com",
          credentials: gcsCredentials,
        },
        parser: new DOMParser(),
      },
    },*/ {
      label: "cloudflare",
      createBucket: false,
      config: {
        pollFrequency: 100,
        defaultBucket: `mps3-demo`,
        s3Config: {
          region: "auto",
          endpoint:
            "https://a3e2af584fbdedd172bede5ca0018aae.r2.cloudflarestorage.com",
          credentials: cloudflareCredentials,
        },
        parser: new DOMParser(),
      },
    },
    {
      label: "aws",
      createBucket: false,
      config: {
        defaultBucket: `mps3-demo`,
        s3Config: {
          region: "eu-central-1",
          credentials: awsCredentials,
        },
        parser: new DOMParser(),
      },
    },
    {
      label: "proxy",
      createBucket: false,
      config: {
        defaultBucket: `s3-demo`,
        defaultManifest: `proxy`,
        s3Config: {
          region: "eu-central-1",
          endpoint: "https://mps3-proxy.endpointservices.workers.dev",
        },
        parser: new DOMParser(),
      },
    },
  ];

  configs.map((variant) =>
    describe(variant.label, () => {
      beforeAll(async () => {
        const s3 = new S3(variant.config.s3Config);
        if (variant.createBucket !== false) {
          await s3.createBucket({
            Bucket: variant.config.defaultBucket,
          });
        }

        if (variant.config.useVersioning) {
          await s3.putBucketVersioning({
            Bucket: variant.config.defaultBucket,
            VersioningConfiguration: {
              Status: "Enabled",
            },
          });
        }
      });
      const getClient = (args?: { label?: string; clockOffset?: number }) =>
        new MPS3({
          label: args?.label || uuid().substring(32),
          ...variant.config,
          clockOffset: args?.clockOffset ?? Math.random() * 2000 - 1000,
        });

      test("Subscription deduplicate undefined", async (done) => {
        const mps3 = getClient();
        const listener = getClient();
        const rnd = uuid();
        await mps3.delete("dedupe", undefined);

        let notifications = 0;
        listener.subscribe("dedupe", async (value) => {
          notifications++;
          if (notifications === 1) {
            expect(value).toEqual(undefined);
            await mps3.delete("dedupe");
            mps3.put("dedupe", rnd);
          } else if (notifications === 2) {
            expect(value).toEqual(rnd);
            done();
          }
        });
      }, 100000);

      test("Can see other's mutations after populating cache", async () => {
        const mps3 = getClient({ clockOffset: 0 });
        const rnd = uuid();
        await mps3.put("rw1", rnd);
        await getClient({ clockOffset: 0 }).delete("rw1");

        // pending cache masks server until committed
        while ((await mps3.get("rw1")) !== undefined) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        const read = await mps3.get("rw1");
        expect(read).toEqual(undefined);
      });

      test("Read no manifest", async () => {
        const mps3 = getClient();
        const read = await mps3.get("unused_key", {
          manifest: {
            key: uuid(),
          },
        });
        expect(read).toEqual(undefined);
      });

      test("manifest cold start", async () => {
        if (variant.label === "localfirst") return;
        console.log(
          "variant.config.defaultBucket",
          variant.config.defaultBucket
        );
        const s3 = new S3(variant.config.s3Config);
        const mps3 = getClient();
        const manifest: ResolvedRef = {
          key: uuid(),
          bucket: variant.config.defaultBucket,
        };
        await mps3.put("unused_key_2", "", {
          manifests: [manifest],
        });

        // Blackbox test for outcome
        const pollFile = await s3.getObject({
          Bucket: variant.config.defaultBucket,
          Key: manifest.key,
        });
        const manifestVersions = await s3.listObjectsV2({
          Prefix: manifest.key,
          Bucket: variant.config.defaultBucket,
        });

        // First call we don't have a previous version setup
        const pollContent = await pollFile.Body?.transformToString();
        expect(pollContent).toEqual('"."');
        // First we expect two files, the pollFile + one other version file
        expect(manifestVersions.KeyCount).toEqual(2);
        const versionFileKey = manifestVersions.Contents![1].Key;

        const versionFile = await s3.getObject({
          Bucket: variant.config.defaultBucket,
          Key: versionFileKey,
        });
        const versionFileContent = JSON.parse(
          await versionFile.Body?.transformToString()!
        );
        expect(versionFileContent.files).toEqual({}); // base version is empty
        console.log(versionFileContent);
        expect(
          versionFileContent.update.files[
            `${variant.config.defaultBucket}/unused_key_2`
          ]
        ).toBeDefined();

        await new Promise((resolve) => setTimeout(resolve, 500)); // wait to settle
        await mps3.get("unused_key_2", {
          // force a refresh
          manifest: manifest,
        });
        // Second call we have a previous version setup
        await mps3.put("unused_key_2", "", {
          manifests: [manifest],
        });

        const pollFile2 = await s3.getObject({
          Bucket: variant.config.defaultBucket,
          Key: manifest.key,
        });

        const manifestVersions2 = await s3.listObjectsV2({
          Prefix: manifest.key,
          Bucket: variant.config.defaultBucket,
        });

        // Second call we expect the previous version to be setup
        const pollContent2 = await pollFile2.Body?.transformToString();
        expect(pollContent2).toEqual('"' + versionFileKey + '"');
      });

      test("Read unknown key resolves to undefined", async () => {
        const mps3 = getClient();
        const read = await mps3.get("unused_key");
        expect(read).toEqual(undefined);
      });

      test("Delete key by setting to undefined", async () => {
        const mps3 = getClient();
        await mps3.put("delete", "");
        await mps3.put("delete", undefined);
        const read = await mps3.get("delete");
        expect(read).toEqual(undefined);
      });

      test("Can read a write", async () => {
        const rnd = uuid();
        await getClient().put("rw", rnd);
        const read = await getClient().get("rw");
        expect(read).toEqual(rnd);
      });

      test("Read own write twice", async (done) => {
        const client = getClient();
        const rnd1 = uuid();
        const rnd2 = uuid();
        let seenRnd1 = false;

        client.subscribe("rwt", (val) => {
          if (val === undefined && !seenRnd1) {
            client.put("rwt", rnd1);
          } else if (val == rnd1 && !seenRnd1) {
            client.put("rwt", rnd2);
            seenRnd1 = true;
          } else if (val == rnd2 && seenRnd1) {
            done();
          } else {
            console.error("val", val, "seenRnd1", seenRnd1);
            expect(false).toBe(true);
          }
        });
      });

      test("Key encoding", async () => {
        const rnd = uuid();
        const key = `&$@=;[~|^  :+,"?\\\{^}%\]>#\x01\x1F\x80\xFF`;
        await getClient().put(key, rnd);
        const read = await getClient().get(key);
        expect(read).toEqual(rnd);
      });

      test("Unsubscribe releases client", async () => {
        const mps3 = getClient({
          label: "unsubscribe",
        });
        const unsubscribe = mps3.subscribe("unused_key", () => {});
        expect(mps3.subscriberCount).toEqual(1);
        unsubscribe();
        expect(mps3.subscriberCount).toEqual(0);
      });

      test("Storage key representation", async () => {
        const s3 = new S3(variant.config.s3Config);
        const client = await getClient();
        await client.put("storage_key", "foo");
        if (variant.config.useVersioning) {
          const storage = await s3.getObject({
            Bucket: variant.config.defaultBucket,
            Key: "storage_key",
          });
          expect(storage.VersionId).toBeDefined();
        } else {
          try {
            const storage = await s3.getObject({
              Bucket: variant.config.defaultBucket,
              Key: "storage_key",
            });
            expect(false).toBe(true);
          } catch (e) {}
        }
      });

      test("Can read a write (cold manifest)", async () => {
        const manifest = {
          key: `manifest_${uuid()}`,
        };
        const rnd = uuid();
        await getClient().put("rw", rnd, {
          manifests: [manifest],
        });
        const read = await getClient().get("rw", {
          manifest: manifest,
        });
        expect(read).toEqual(rnd);
      });

      test("Can read your write uses cache", async (done) => {
        const mps3 = getClient();
        const rnd = uuid();
        const promise = mps3.put("rw", rnd); // no await
        let has_read = false;
        promise.then(() => {
          expect(has_read).toEqual(true);
          done();
        });
        const read = await mps3.get("rw");
        has_read = true;
        expect(read).toEqual(rnd);
      });

      test("Consecutive gets use manifest cache", async () => {
        const mps3 = getClient();
        await mps3.get("cache_get");
        await mps3.get("cache_get");
      });

      test("Subscribe to a single change (single client, unseeen key)", async (done) => {
        const mps3 = getClient();
        const rand_key = `subscribe_single_client/${uuid()}`;
        const rnd = uuid();
        expect(mps3.subscriberCount).toEqual(0);
        let callbackCount = 0;
        const unsubscribe = mps3.subscribe(rand_key, (value) => {
          expect(mps3.subscriberCount).toEqual(1);
          if (callbackCount === 0) {
            expect(value).toEqual(undefined);
            callbackCount++;
            mps3.put(rand_key, rnd);
          } else if (callbackCount === 1) {
            expect(value).toEqual(rnd);
            unsubscribe();
            expect(mps3.subscriberCount).toEqual(0);
            done();
          }
        });
        expect(mps3.subscriberCount).toEqual(1);
      });

      test("Subscribe to a single change (cross-client, unseeen key)", async (done) => {
        const mps3 = getClient();
        const mps3_other = getClient();
        const rand_key = `subscribe_multi_client/${uuid()}`;
        expect(mps3.subscriberCount).toEqual(0);
        expect(mps3_other.subscriberCount).toEqual(0);
        let callbackCount = 0;
        const unsubscribe = mps3_other.subscribe(rand_key, (value) => {
          if (callbackCount === 0) {
            expect(value).toEqual(undefined);
            callbackCount++;
            mps3.put(rand_key, "_");
          } else if (callbackCount === 1) {
            expect(value).toEqual("_");
            unsubscribe();
            done();
          }
        });
      });

      test("Subscribe to a converging monotonic stream of changes (cross-client)", async (done) => {
        const mps3 = getClient();
        const mps3_other = getClient();
        const key = `subscribe_multi_client/${uuid()}`;
        expect(mps3.subscriberCount).toEqual(0);
        expect(mps3_other.subscriberCount).toEqual(0);

        let i = 0;
        let last_write = 0;
        const check = (last_read: any) => {
          seen.push(last_read);
          console.log("monotonic", seen, last_write, last_read);
          if (seen.length >= 5 && last_read === last_write) {
            unsubscribe();
            expect(seen[0]).toEqual(undefined);
            const numbers = seen.slice(1);
            expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
            done();
          } else if (seen.length < 5) {
            // write in bursts to shake out races
            mps3.put(key, i++);
            mps3.put(key, i++);
            last_write = i - 1;
          }
        };

        const seen: any[] = [];
        var unsubscribe = mps3_other.subscribe(key, check);
      }, 99999);

      test("Subscribe notified of committed initial value first", async (done) => {
        const mps3 = getClient();
        const rnd = uuid();
        await mps3.put("subscribe_initial", rnd);

        const unsubscribe = mps3.subscribe("subscribe_initial", (value) => {
          expect(value).toEqual(rnd);
          unsubscribe();
          done();
        });
      });

      test("Subscribe get notified of optimistic value first", async (done) => {
        const mps3 = getClient();
        const rnd = uuid();
        mps3.put("subscribe_initial_optimistic", rnd);

        const unsubscribe = await mps3.subscribe(
          "subscribe_initial_optimistic",
          (value) => {
            expect(value).toEqual(rnd);
            unsubscribe();
            done();
          }
        );
      });

      test("Parallel puts commute - warm manifest - single read", async () => {
        await getClient().put("warm", null);
        const n = 3;
        const clients = [...Array(n)].map((_) => getClient());
        const rand_keys = [...Array(n)].map(
          (_, i) => `parallel_put/${i}_${uuid()}`
        );

        // put in parallel
        await Promise.all(rand_keys.map((key, i) => clients[i].put(key, i)));

        // read in parallel
        expect(await getClient().get(rand_keys[1])).toEqual(1);
      });

      test("Parallel puts commute - warm manifest", async () => {
        await getClient().put("warm", null);
        const n = 3;
        const clients = [...Array(n)].map((_) => getClient());
        const rand_keys = [...Array(n)].map(
          (_, i) => `parallel_put/${i}_${uuid()}`
        );

        // put in parallel
        await Promise.all(rand_keys.map((key, i) => clients[i].put(key, i)));

        // read in parallel
        const reads = await Promise.all(
          rand_keys.map((key, i) => clients[n - i - 1].get(key))
        );

        expect(reads).toEqual([...Array(n)].map((_, i) => i));
      });

      test("Parallel puts commute - cold manifest", async () => {
        const manifests = [
          {
            key: uuid(),
          },
        ];
        const n = 3;
        const clients = [...Array(n)].map((_) => getClient());
        const rand_keys = [...Array(n)].map(
          (_, i) => `parallel_put/${i}_${uuid()}`
        );

        // put in parallel
        await Promise.all(
          rand_keys.map((key, i) =>
            clients[i].put(key, i, {
              manifests,
            })
          )
        );

        // read in parallel
        const reads = await Promise.all(
          rand_keys.map((key, i) =>
            clients[n - i - 1].get(key, {
              manifest: manifests[0],
            })
          )
        );

        expect(reads).toEqual([...Array(n)].map((_, i) => i));
      });

      test("Parallel puts notify other clients", async () => {
        const n = 3;
        const clients = [...Array(n)].map((_) => getClient());
        const rand_keys = [...Array(n)].map(
          (_, i) => `parallel_put/${i}_${uuid()}`
        );

        // collect results
        const results = Promise.all(
          rand_keys.map(
            (key) =>
              new Promise((resolve) =>
                getClient().subscribe(key, (val) => {
                  if (val !== undefined) resolve(val);
                })
              )
          )
        );

        // put in parallel
        rand_keys.map((key, i) => clients[i].put(key, i));

        expect(await results).toEqual([0, 1, 2]);
      });
    })
  );
});
