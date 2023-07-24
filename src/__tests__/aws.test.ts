import { S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll } from "bun:test";
import { MPS3 } from "mps3";

describe("mps3", () => {
  let mps3: MPS3;

  beforeAll(async () => {
    const credentials = require("../../credentials/tomlarkworthy-access-aws.json");
    const s3 = new S3({
      region: "eu-central-1",
      credentials: credentials,
    });

    console.log("enable version");
    mps3 = new MPS3({
      defaultBucket: "tomlarkworthy-access-aws",
      api: s3,
    });
  });

  test("Can read your write, no multiplayer", async () => {
    console.log("can read your write (number)");
    const rnd = Math.random();
    await mps3.put("test", rnd, {
      manifests: [],
    });
    const read = await mps3.get("test");
    expect(read).toEqual(rnd);
  });
});
