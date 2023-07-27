import { PutObjectCommandInput, S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll, beforeEach } from "bun:test";
import { MPS3, uuidRegex } from "mps3";

describe("mps3", () => {
  let mps3: MPS3, mps3_other: MPS3;

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

    mps3_other = new MPS3({
      defaultBucket: "test5",
      api: s3,
    });
  });

  test("Can read your write (number)", async () => {
    const rnd = Math.random();
    await mps3.put("rw", rnd);
    const read = await mps3.get("rw");
    expect(read).toEqual(rnd);
  });

  test("Subscribe to changes (single client, unseeen key)", async (done) => {
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
});
