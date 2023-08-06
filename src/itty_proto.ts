import { AwsClient } from "aws4fetch";
import { PutObjectCommandInput, S3Client } from "@aws-sdk/client-s3";
import { fetcher } from "itty-fetcher";

export const run = async () => {
	const s3 = new S3({
		endpoint: "http://127.0.0.1:9102",
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

	const client = fetcher({
		base: "http://127.0.0.1:9102",
	});

	console.log("calling", AwsClient);
	const aws = new AwsClient({
		service: "s3",
		accessKeyId: "mps3",
		secretAccessKey: "ZOAmumEzdsUUcVlQ",
	});

	aws.console.log("sign");
	const request = await aws.sign("http://127.0.0.1:9102/test2/cool", {
		method: "PUT", // if not supplied, will default to 'POST' if there's a body, otherwise 'GET'
		body: "{}",
	});
};
run();

setTimeout(() => {}, 1000);
