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
  options?: object | undefined,
) => Promise<Response>;


const retry = async <T>(
  fn: () => Promise<T>,
  options: {
    retries: number;
    delay: number;
  } = {
    retries: Number.MAX_VALUE,
    delay: 100,
  }
): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (options.retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
      return await retry(fn, {
        retries: options.retries - 1,
        delay: options.delay,
      });
    } else {
      throw e;
    }
  }
};

export class S3ClientLite {
  fetch: FetchFn;
  endpoint: string;
  parser: DOMParser;
  constructor(fetch: FetchFn, endpoint: string, parser: DOMParser) {
    this.fetch = fetch;
    this.endpoint = endpoint;
    this.parser = parser;
  }

  async listObjectV2(
    command: ListObjectsV2CommandInput
  ): Promise<ListObjectsV2CommandOutput> {
    // retry loop for 429
    for (let i = 0; i < 10; i++) {
      const url = `${this.endpoint}/${command.Bucket!}/?list-type=2&prefix=${
        command.Prefix
      }`;
      const response = await retry(() => this.fetch(url, {}));
      if (response.status === 200) {
        const xml = await response.text();
        const result = parseListObjectsV2CommandOutput(xml, this.parser);
        return result;
      } else if (response.status === 429) {
        console.warn("listObjectV2: 429, retrying");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        throw new Error(
          `Unexpected response: ${response.status} ${response.text()}`
        );
      }
    }
    throw new Error("Cannot contact server");
  }

  async putObject(
    command: PutObjectCommandInput
  ): Promise<PutObjectCommandOutput> {
    const url = `${this.endpoint}/${command.Bucket!}/${command.Key}`;
    const response = await retry(() =>
      this.fetch(url, {
        method: "PUT",
        body: <string>command.Body,
        headers: {
          "Content-Type": "application/json",
          ...(command.ChecksumSHA256 && {
            "x-amz-content-sha256": command.ChecksumSHA256,
          }),
        },
      })
    );
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
    const response = await retry(() =>
      this.fetch(url, {
        method: "DELETE",
      })
    );
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
    const response = await retry(() =>
      this.fetch(url, {
        method: "GET",
        headers: {
          "If-None-Match": command.IfNoneMatch!,
        },
      })
    );
    if (response.status == 304) {
      const err = new Error();
      err.name = "304";
      throw err;
    }
    let content: any;
    if (response.status == 404) {
      content = undefined;
    } else if (response.status == 403) {
      throw new Error("Access denied");
    } else if (response.headers.get("content-type") === "application/json") {
      content = await response.json();
    } else {
      // still try to parse it as json
      const responseText = await response.text();
      if (responseText === "") {
        content = undefined;
      } else {
        try {
          content = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Failed to parse response as JSON ${url}`);
        }
      }
    }
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
