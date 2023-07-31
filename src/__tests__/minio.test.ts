import { PutObjectCommandInput, S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll, beforeEach } from "bun:test";
import { MPS3, uuidRegex } from "mps3";

describe("mps3", () => {
  let s3: S3;
  beforeAll(async () => {
    s3 = new S3({
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
  });

  const getClient = () =>
    new MPS3({
      defaultBucket: "test5",
      api: s3,
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

  test("Can read your write (number)", async () => {
    const mps3 = getClient();
    const rnd = Math.random();
    await mps3.put("rw", rnd);
    const read = await mps3.get("rw");
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
    const unsubscribe = await mps3.subscribe(rand_key, (value) => {
      expect(mps3.subscriberCount).toEqual(1);
      expect(value).toEqual(rnd);
      unsubscribe();
      expect(mps3.subscriberCount).toEqual(0);
      done();
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

    const unsubscribe = await mps3_other.subscribe(rand_key, (value) => {
      expect(value).toEqual("_");
      unsubscribe();
      done();
    });
    mps3.put(rand_key, "_");
  });

  test("Subscribe get committed initial value first", async (done) => {
    const mps3 = getClient();
    const rnd = Math.random();
    await mps3.put("subscribe_initial", rnd);

    const unsubscribe = await mps3.subscribe("subscribe_initial", (value) => {
      expect(value).toEqual(rnd);
      unsubscribe();
      done();
    });
  });

  /*
  test("Subscribe get optimistic initial value first", async (done) => {
    const mps3 = getClient();
    const rnd = Math.random();
    mps3.put("subscribe_initial", rnd);

    const unsubscribe = await mps3.subscribe("subscribe_initial", (value) => {
      expect(value).toEqual(rnd);
      unsubscribe();
      done();
    });
  });*/

  // TODO, but with parrallel puts on a blank manifest
  test("Parallel puts commute (warm manifest)", async () => {
    await getClient().put("null", null);
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
  /*
  test("Parallel puts commute (cold manifest)", async () => {
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
  });*/
});
