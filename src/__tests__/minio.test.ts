import { S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll } from "bun:test";
import { MPS3 } from "mps3";

describe("mps3", () => {
  let s3: S3;
  let bucket = `t${Math.random().toString(16).substring(2, 9)}`;
  const s3Config = {
    endpoint: "http://127.0.0.1:9102",
    region: "eu-central-1",
    credentials: {
      accessKeyId: "mps3",
      secretAccessKey: "ZOAmumEzdsUUcVlQ",
    },
  };

  beforeAll(async () => {
    s3 = new S3(s3Config);

    await s3.createBucket({
      Bucket: bucket,
    });

    await s3.putBucketVersioning({
      Bucket: bucket,
      VersioningConfiguration: {
        Status: "Enabled",
      },
    });
  });

  const getClient = () =>
    new MPS3({
      defaultBucket: bucket,
      s3Config: s3Config,
    });

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

    const unsubscribe = await mps3.subscribe("subscribe_initial", (value) => {
      expect(value).toEqual(rnd);
      unsubscribe();
      done();
    });
  });

  test("Parallel puts commute (warm manifest)", async () => {
    await getClient().put("null", null);
    const n = 3;
    const clients = [...Array(n)].map((_) => getClient());
    const rand_keys = [...Array(n)].map(
      (_, i) => `parallel_put/${i}_${Math.random().toString()}`,
    );

    // put in parallel
    await Promise.all(rand_keys.map((key, i) => clients[i].put(key, i)));

    // read in parallel
    const reads = await Promise.all(
      rand_keys.map((key, i) => clients[n - i - 1].get(key)),
    );

    expect(reads).toEqual([...Array(n)].map((_, i) => i));
  });

  test("Parallel puts commute (cold manifest)", async () => {
    const manifests = [
      {
        key: Math.random().toString(),
      },
    ];
    const n = 3;
    const clients = [...Array(n)].map((_) => getClient());
    const rand_keys = [...Array(n)].map(
      (_, i) => `parallel_put/${i}_${Math.random().toString()}`,
    );

    // put in parallel
    await Promise.all(
      rand_keys.map((key, i) =>
        clients[i].put(key, i, {
          manifests,
        }),
      ),
    );

    // read in parallel
    const reads = await Promise.all(
      rand_keys.map((key, i) =>
        clients[n - i - 1].get(key, {
          manifest: manifests[0],
        }),
      ),
    );

    expect(reads).toEqual([...Array(n)].map((_, i) => i));
  });

  test("Parallel puts notify other clients", async () => {
    const n = 3;
    const clients = [...Array(n)].map((_) => getClient());
    const rand_keys = [...Array(n)].map(
      (_, i) => `parallel_put/${i}_${Math.random().toString()}`,
    );

    // collect results
    const results = Promise.all(
      rand_keys.map(
        (key) =>
          new Promise((resolve) =>
            getClient().subscribe(key, (val) => {
              if (val !== undefined) resolve(val);
            }),
          ),
      ),
    );

    // put in parallel
    rand_keys.map((key, i) => clients[i].put(key, i));

    expect(await results).toEqual([0, 1, 2]);
  });
});
