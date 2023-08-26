import {
  DeleteObjectCommand,
  DeleteObjectCommandOutput,
  GetObjectCommand,
  GetObjectCommandOutput,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  PutObjectCommand,
  PutObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { AwsClient } from "aws4fetch";
import { parseListObjectsV2CommandOutput } from "xml";

export class S3ClientLite {
  client: AwsClient;
  endpoint: string;
  parser: DOMParser;
  constructor(client: AwsClient, endpoint: string, parser: DOMParser) {
    this.client = client;
    this.endpoint = endpoint;
    this.parser = parser;
  }

  async listObjectV2(
    command: ListObjectsV2Command
  ): Promise<ListObjectsV2CommandOutput> {
    const url = `${this.endpoint}/${command.input.Bucket!}?list-type=2&prefix=${
      command.input.Prefix
    }`;
    const response = await this.client.fetch(url, {});
    const xml = await response.text();
    const result = parseListObjectsV2CommandOutput(xml, this.parser);
    return result;
  }

  async putObject(command: PutObjectCommand): Promise<PutObjectCommandOutput> {
    const url = `${this.endpoint}/${command.input.Bucket!}/${
      command.input.Key
    }`;
    const response = await this.client.fetch(url, {
      method: "PUT",
      body: command.input.Body,
    });
    if (response.status != 200) throw new Error("Failed to put object");
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
    command: DeleteObjectCommand
  ): Promise<DeleteObjectCommandOutput> {
    const url = `${this.endpoint}/${command.input.Bucket!}/${
      command.input.Key
    }`;
    const response = await this.client.fetch(url, {
      method: "DELETE",
    });
    return {
      $metadata: {
        httpStatusCode: response.status,
      },
    };
  }

  async getObject(command: GetObjectCommand): Promise<GetObjectCommandOutput> {
    const url = `${this.endpoint}/${command.input.Bucket!}/${
      command.input.Key
    }?${command.input.VersionId ? `versionId=${command.input.VersionId}` : ""}`;
    const response = await this.client.fetch(url, {
      method: "GET",
      headers: {
        "If-None-Match": command.input.IfNoneMatch!,
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
