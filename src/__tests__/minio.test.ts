import { S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll } from "bun:test";
import { MPS3 } from "mps3";

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
      // logger: console,
    });

    try {
      console.log("creating bucket");
      await s3.createBucket({
        Bucket: "test",
      });
    } catch (e) {}

    try {
      console.log("enable version");
      await s3.putBucketVersioning({
        Bucket: "test",
        VersioningConfiguration: {
          Status: "Enabled",
        },
      });
    } catch (e) {
      console.error(e);
    }

    console.log("enable version");
    mps3 = new MPS3({
      defaultBucket: "test",
      api: s3,
    });
  });

  test("can read your write (number)", async () => {
    console.log("can read your write (number)");
    const rnd = Math.random();
    await mps3.put("test", rnd);
    const read = await mps3.get("test");
    expect(read).toEqual(rnd);
  });
});
