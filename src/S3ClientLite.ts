import {
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
  PutObjectCommandInput,
  PutObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { parseListObjectsV2CommandOutput } from "xml";

export type FetchFn = (
  url: string,
  options?: object | undefined
) => Promise<Response>;

export class S3ClientLite {
  client: FetchFn;
  endpoint: string;
  parser: DOMParser;
  constructor(fetch: FetchFn, endpoint: string, parser: DOMParser) {
    this.client = fetch;
    this.endpoint = endpoint;
    this.parser = parser;
  }

  async listObjectV2(
    command: ListObjectsV2CommandInput
  ): Promise<ListObjectsV2CommandOutput> {
    const url = `${this.endpoint}/${command.Bucket!}/?list-type=2&prefix=${
      command.Prefix
    }`;
    const response = await this.client(url, {});
    const xml = await response.text();
    const result = parseListObjectsV2CommandOutput(xml, this.parser);
    return result;
  }

  async putObject(
    command: PutObjectCommandInput
  ): Promise<PutObjectCommandOutput> {
    const url = `${this.endpoint}/${command.Bucket!}/${command.Key}`;
    const response = await this.client(url, {
      method: "PUT",
      body: <string>command.Body,
      headers: {
        "Content-Type": "application/json",
        ...(command.ChecksumSHA256 && {
          "x-amz-content-sha256": command.ChecksumSHA256,
        }),
      },
    });
    if (response.status != 200)
      throw new Error(`Failed to PUT: ${await response.text()}`);
    return {
      $metadata: {
        httpStatusCode: response.status,
      },
      ETag: response.headers.get("ETag")!,
      ...(response.headers.get("x-amz-version-id") && {
        VersionId: response.headers.get("x-amz-version-id")!,
      }),
    };
  }

  async deleteObject(
    command: DeleteObjectCommandInput
  ): Promise<DeleteObjectCommandOutput> {
    const url = `${this.endpoint}/${command.Bucket!}/${command.Key}`;
    const response = await this.client(url, {
      method: "DELETE",
    });
    return {
      $metadata: {
        httpStatusCode: response.status,
      },
    };
  }

  async getObject(
    command: GetObjectCommandInput
  ): Promise<GetObjectCommandOutput> {
    const url = `${this.endpoint}/${command.Bucket!}/${command.Key}?${
      command.VersionId ? `versionId=${command.VersionId}` : ""
    }`;
    const response = await this.client(url, {
      method: "GET",
      headers: {
        "If-None-Match": command.IfNoneMatch!,
      },
    });
    if (response.status == 304) {
      const err = new Error();
      err.name = "304";
      throw err;
    }

    const content = response.status == 404 ? undefined : await response.json();
    return {
      $metadata: {
        httpStatusCode: response.status,
      },
      Body: content,
      ETag: response.headers.get("ETag")!,
      ...(response.headers.get("x-amz-version-id") && {
        VersionId: response.headers.get("x-amz-version-id")!,
      }),
    };
  }
}
