import { AwsClient } from "aws4fetch";
import { PutObjectCommandInput, S3 } from "@aws-sdk/client-s3";

export const run = async () => {
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
  } catch (e) {
    console.error(e);
  }

  console.log("calling", AwsClient);
  const aws = new AwsClient({
    service: "s3",
    accessKeyId: "mps3",
    secretAccessKey: "ZOAmumEzdsUUcVlQ",
  });

  console.log("sign");
  const request = await aws.sign("http://127.0.0.1:9000/test2/cool", {
    method: "PUT", // if not supplied, will default to 'POST' if there's a body, otherwise 'GET'
    body: "{}",
  });
  console.log("request", request);

  const fetchRes = await fetch(request);
  console.log(await fetchRes.text());

  const res = await aws.fetch("http://127.0.0.1:9000/test2/cool", {
    body: "{}",
    method: "PUT",
  });
  console.log(res);
  console.log("called");

  // On node
  /*
  {
    '$metadata': {
        httpStatusCode: 200,
        requestId: '17747B269B2DB505',
        extendedRequestId: 'dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8',
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    ETag: '"d41d8cd98f00b204e9800998ecf8427e"',
    VersionId: '0c6245b2-6e75-4705-b861-ae2d9e2307cf'
    }
    */
  /* on bun */
  /*
    {
    $metadata: {
        httpStatusCode: 200,
        requestId: "17747B383E61D15D",
        extendedRequestId: "dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8",
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    ETag: "\"d41d8cd98f00b204e9800998ecf8427e\"",
    VersionId: "9a7381ab-27e3-42ad-92ea-5e0ddb831e2a"
    }
   */
};

run();
