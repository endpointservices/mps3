/// <reference lib="dom" />

import { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";

export const parseListObjectsV2CommandOutput = (
  xml: string,
  domParser: DOMParser
): ListObjectsV2CommandOutput => {
  const doc = domParser.parseFromString(xml, "text/xml");
  const results = doc.querySelector("ListBucketResult");
  const contents = doc.querySelectorAll("Contents");
  const commonPrefixes = doc.querySelector("CommonPrefixes");
  if (results === null || contents === null) throw new Error("Invalid XML");
  return {
    $metadata: {},
    IsTruncated: results.querySelector("IsTruncated")?.textContent === "true",
    Contents: Array.from(contents).map((content) => ({
      ChecksumAlgorithm: [
        content.querySelector("ChecksumAlgorithm")?.textContent!,
      ],
      ETag: content.querySelector("ETag")?.textContent!,
      Key: content.querySelector("Key")?.textContent!,
      LastModified: new Date(
        content.querySelector("LastModified")?.textContent!
      ),
      Owner: {
        DisplayName: content.querySelector("DisplayName")?.textContent!,
        ID: content.querySelector("ID")?.textContent!,
      },
      RestoreStatus: {
        IsRestoreInProgress:
          content.querySelector("IsRestoreInProgress")?.textContent! === "true",
        RestoreExpiryDate: new Date(
          content.querySelector("RestoreExpiryDate")?.textContent!
        ),
      },
      Size: Number.parseInt(content.querySelector("Size")?.textContent!),
      StorageClass: content.querySelector("StorageClass")?.textContent!,
    })),
    Name: doc.querySelector("Name")?.textContent!,
    Prefix: doc.querySelector("Prefix")?.textContent!,
    Delimiter: doc.querySelector("Delimiter")?.textContent!,
    MaxKeys: Number.parseInt(doc.querySelector("MaxKeys")?.textContent!),
    CommonPrefixes: Array.from(
      commonPrefixes ? commonPrefixes.querySelectorAll("Prefix") : [],
      (prefix) => ({
        Prefix: prefix?.textContent!,
      })
    ),
    EncodingType: doc.querySelector("EncodingType")?.textContent!,
    KeyCount: Number.parseInt(doc.querySelector("KeyCount")?.textContent!),
    ContinuationToken: doc.querySelector("ContinuationToken")?.textContent!,
    NextContinuationToken: doc.querySelector("NextContinuationToken")
      ?.textContent!,
    StartAfter: doc.querySelector("StartAfter")?.textContent!,
  };
};
