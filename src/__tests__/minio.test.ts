import { S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll } from "bun:test";
import { MPS3, MPS3Config } from "mps3";
import { uuid } from "types";
import { Grounding, Knowledge, check } from "./consistency";

describe("mps3", () => {
  let s3: S3;
  let session = Math.random().toString(16).substring(2, 6);
  const s3Config = {
    endpoint: "http://127.0.0.1:9102",
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
        s3Config: s3Config,
      },
    },
    {
      label: "noVersioning",
      config: {
        pollFrequency: 100,
        useChecksum: false,
        // useVersioning: false, // is the default
        defaultBucket: `nov${session}`,
        s3Config: s3Config,
      },
    },
  ];

  configs.map((variant) =>
    describe(variant.label, () => {
      beforeAll(async () => {
        s3 = new S3(variant.config.s3Config);

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
      const getClient = () => new MPS3(variant.config);

      test("Subscription deduplicate undefined", async (done) => {
        const mps3 = getClient();
        const listener = getClient();
        const rnd = Math.random();
        await mps3.delete("dedupe", undefined);

        let notifications = 0;
        listener.subscribe("dedupe", (value) => {
          if (notifications === 0) expect(value).toEqual(undefined);
          if (notifications === 1) {
            expect(value).toEqual(rnd);
            done();
          }
          notifications++;
        });
        await mps3.delete("dedupe");
        await listener.refresh();
        await mps3.put("dedupe", rnd);
        await listener.refresh();
      });

      test("Can see other's mutations after populating cache", async () => {
        const mps3 = getClient();
        const rnd = Math.random();
        await mps3.put("rw", rnd);
        await getClient().delete("rw");

        // pending cache masks server until committed
        while ((await mps3.get("rw")) !== undefined) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        const read = await mps3.get("rw");
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
        const rnd = Math.random();
        await getClient().put("rw", rnd);
        const read = await getClient().get("rw");
        expect(read).toEqual(rnd);
      });

      test("Storage key representation", async () => {
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
          key: `manifest_${Math.random()}`,
        };
        const rnd = Math.random();
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
        const rnd = Math.random();
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

      test("Subscribe to changes (single client, unseeen key)", async (done) => {
        const mps3 = getClient();
        const rand_key = `subscribe_single_client/${Math.random().toString()}`;
        const rnd = Math.random();
        expect(mps3.subscriberCount).toEqual(0);
        let callbackCount = 0;
        const unsubscribe = mps3.subscribe(rand_key, (value) => {
          expect(mps3.subscriberCount).toEqual(1);
          if (callbackCount === 0) {
            expect(value).toEqual(undefined);
            callbackCount++;
          } else if (callbackCount === 1) {
            expect(value).toEqual(rnd);
            unsubscribe();
            expect(mps3.subscriberCount).toEqual(0);
            done();
          }
        });
        mps3.put(rand_key, rnd);
        expect(mps3.subscriberCount).toEqual(1);
      });

      test("Subscribe to changes (cross-client, unseeen key)", async (done) => {
        const mps3 = getClient();
        const mps3_other = getClient();
        const rand_key = `subscribe_multi_client/${Math.random().toString()}`;
        expect(mps3.subscriberCount).toEqual(0);
        expect(mps3_other.subscriberCount).toEqual(0);
        let callbackCount = 0;
        const unsubscribe = mps3_other.subscribe(rand_key, (value) => {
          if (callbackCount === 0) {
            expect(value).toEqual(undefined);
            callbackCount++;
          } else if (callbackCount === 1) {
            expect(value).toEqual("_");
            unsubscribe();
            done();
          }
        });
        mps3.put(rand_key, "_");
      });

      test("Subscribe get notified of committed initial value first", async (done) => {
        const mps3 = getClient();
        const rnd = Math.random();
        await mps3.put("subscribe_initial", rnd);

        const unsubscribe = mps3.subscribe("subscribe_initial", (value) => {
          expect(value).toEqual(rnd);
          unsubscribe();
          done();
        });
      });

      test("Subscribe get notified of optimistic value first", async (done) => {
        const mps3 = getClient();
        const rnd = Math.random();
        mps3.put("subscribe_initial", rnd);

        const unsubscribe = await mps3.subscribe(
          "subscribe_initial",
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
          (_, i) => `parallel_put/${i}_${Math.random().toString()}`
        );

        // put in parallel
        await Promise.all(rand_keys.map((key, i) => clients[i].put(key, i)));

        // await new Promise((resolve) => setTimeout(resolve, 1000));
        // read in parallel
        expect(await getClient().get(rand_keys[1])).toEqual(1);
      });

      test("Parallel puts commute - warm manifest", async () => {
        await getClient().put("warm", null);
        const n = 3;
        const clients = [...Array(n)].map((_) => getClient());
        const rand_keys = [...Array(n)].map(
          (_, i) => `parallel_put/${i}_${Math.random().toString()}`
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
            key: Math.random().toString(),
          },
        ];
        const n = 3;
        const clients = [...Array(n)].map((_) => getClient());
        const rand_keys = [...Array(n)].map(
          (_, i) => `parallel_put/${i}_${Math.random().toString()}`
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
          (_, i) => `parallel_put/${i}_${Math.random().toString()}`
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

      test("causal consistency all-to-all, single key", async (done) => {
        const key = "causal";
        await getClient().delete(key);

        const max_steps = 10;
        let global_time = 0;
        const client_clocks = [1, 1, 1];
        const grounding: Grounding = {
          C0_0: 0,
          C1_0: 0,
          C2_0: 0,
        };
        const knowledge_base: Knowledge = {};

        type Message = {
          source: number;
          source_time: number;
        };

        const observe = (client: number, message: Message) => {
          global_time++;
          const client_time = client_clocks[client]++;

          console.log(
            `time: ${global_time}\nclient: ${client}\nclient_time: ${client_time}\nsource: ${message.source}\nsource_time: ${message.source_time}`
          );
          // Record the client's timestep in the global time
          Object.assign(grounding, {
            [`C${client}_${client_time}`]: global_time,
          });
          // Record the client next step as in Infinity
          Object.assign(grounding, {
            [`C${client}_${client_time + 1}`]: Number.POSITIVE_INFINITY,
          });

          Object.assign(knowledge_base, {
            // Indicate the progression of time on the client clock
            [`C${client}_${client_time - 1} < C${client}_${client_time}`]: null,
            // The source tick happened-before the client clock
            [`C${message.source}_${message.source_time} < C${client}_${client_time}`]:
              null,
          });
          Object.assign(knowledge_base, {
            // Later messages by the sender will happen-after the clients_clock
            [`C${client}_${client_time + 1} >= C${message.source}_${
              message.source_time
            }`]: null, // Later messages will happen-after
          });
          if (global_time < max_steps) {
            // Check facts are causally consistent so far
            const check_result = check(grounding, knowledge_base);
            if (!check_result) {
              console.error(grounding);
              console.error(knowledge_base);
            }
            expect(check_result).toBe(true);

            // Write a new message
            clients[client].put(key, {
              source: client,
              source_time: client_time,
            });
          } else if (global_time === max_steps) {
            clients.forEach((c) =>
              c.manifests.forEach((m) => m.subscribers.clear())
            );
            done();
          }
        };

        // Setup all clients to forward messages to the observer
        const clients = [...Array(3)].map((_, client_id) => {
          const client = getClient();
          client.subscribe(key, (message) =>
            message ? observe(client_id, <Message>message) : undefined
          );
          return client;
        });

        // kick it off with a write from a client not in the test
        global_time++;
        grounding["C3_0"] = 1;
        clients[0].put(key, {
          source: 3,
          source_time: 0,
        });
      });
    })
  );
});
