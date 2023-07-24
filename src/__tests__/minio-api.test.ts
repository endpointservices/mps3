import { PutObjectCommandInput, S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll } from "bun:test";
import { uuidRegex, sha256 } from "mps3";
import { run } from "repro";

describe("Basic S3 Operations", () => {
  test("putObject returns a UUID4", async () => {
    const s3 = new S3({
      endpoint: "http://127.0.0.1:9000",
      region: "eu-central-1",
      credentials: {
        accessKeyId: "mps3",
        secretAccessKey: "ZOAmumEzdsUUcVlQ",
      },
    });

    try {
      console.log("creating bucket");
      await s3.createBucket({
        Bucket: "test9",
      });
    } catch (e) {}

    try {
      console.log("enable version");
      await s3.putBucketVersioning({
        Bucket: "test9",
        VersioningConfiguration: {
          Status: "Enabled",
        },
      });
      let status = undefined;
      while (status !== "Enabled") {
        status = (await s3.getBucketVersioning({ Bucket: "test9" })).Status;
      }
    } catch (e) {
      console.error(e);
    }
    const content = "dsadsdas";
    const checksum = await sha256(content);
    const command: PutObjectCommandInput = {
      Bucket: "test9",
      Key: "key",
      ContentType: "application/json",
      Body: content,
      ChecksumSHA256: checksum,
    };

    const fileUpdate = await s3.putObject(command);

    expect(fileUpdate.VersionId).toMatch(uuidRegex);
    console.log(fileUpdate);
  });
});
