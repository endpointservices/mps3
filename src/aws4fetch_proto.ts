import { AwsClient } from "aws4fetch";
import { PutObjectCommandInput, S3 } from "@aws-sdk/client-s3";

export const run = async () => {
	const config = {
		endpoint: "http://127.0.0.1:9102",
		region: "eu-central-1",
		credentials: {
			accessKeyId: "mps3",
			secretAccessKey: "ZOAmumEzdsUUcVlQ",
		},
	};
	const s3 = new S3(config);

	try {
		console.log("creating bucket");
		await s3.createBucket({
			Bucket: "test2",
		});
	} catch (e) {}

	try {
		console.log("enable version");
		await s3.putBucketVersioning({
			Bucket: "test2",
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
	const request = await aws.sign("http://127.0.0.1:9102/test2/cool", {
		method: "PUT", // if not supplied, will default to 'POST' if there's a body, otherwise 'GET'
		body: "{}",
	});
	console.log("request", request);

	const fetchRes = await fetch(request);
	console.log(await fetchRes.text());

	const res = await aws.fetch("http://127.0.0.1:9102/test2/cool", {
		method: "GET",
	});
	console.log(await res.text());
	console.log("called");
};
run();

setTimeout(() => {}, 1000);
