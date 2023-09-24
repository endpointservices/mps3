/// <reference lib="dom" />

import { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";

export const parseListObjectsV2CommandOutput = (
  xml: string,
  domParser: DOMParser
): ListObjectsV2CommandOutput => {
  const doc = domParser.parseFromString(xml, "text/xml");
  const results = doc.getElementsByTagName("ListBucketResult")[0];
  const contents = doc.getElementsByTagName("Contents");
  const commonPrefixes = doc.getElementsByTagName("CommonPrefixes")[0];
  if (!results || !contents) throw new Error(`Invalid XML: ${xml}`);
  return {
    $metadata: {},
    IsTruncated:
      results.getElementsByTagName("IsTruncated")[0]?.textContent === "true",
    Contents: Array.from(contents).map((content) => ({
      ChecksumAlgorithm: [
        content.getElementsByTagName("ChecksumAlgorithm")[0]?.textContent!,
      ],
      ETag: content.getElementsByTagName("ETag")[0]?.textContent!,
      Key: content.getElementsByTagName("Key")[0]?.textContent!,
      LastModified: new Date(
        content.getElementsByTagName("LastModified")[0]?.textContent!
      ),
      Owner: {
        DisplayName:
          content.getElementsByTagName("DisplayName")[0]?.textContent!,
        ID: content.getElementsByTagName("ID")[0]?.textContent!,
      },
      Size: Number.parseInt(
        content.getElementsByTagName("Size")[0]?.textContent!
      ),
      StorageClass:
        content.getElementsByTagName("StorageClass")[0]?.textContent!,
    })),
    Name: doc.getElementsByTagName("Name")[0]?.textContent!,
    Prefix: doc.getElementsByTagName("Prefix")[0]?.textContent!,
    Delimiter: doc.getElementsByTagName("Delimiter")[0]?.textContent!,
    MaxKeys: Number.parseInt(
      doc.getElementsByTagName("MaxKeys")[0]?.textContent!
    ),
    CommonPrefixes: Array.from(
      commonPrefixes ? commonPrefixes.getElementsByTagName("Prefix") : [],
      (prefix) => ({
        Prefix: prefix?.textContent!,
      })
    ),
    EncodingType: doc.getElementsByTagName("EncodingType")[0]?.textContent!,
    KeyCount: Number.parseInt(
      doc.getElementsByTagName("KeyCount")[0]?.textContent!
    ),
    ContinuationToken:
      doc.getElementsByTagName("ContinuationToken")[0]?.textContent!,
    NextContinuationToken: doc.getElementsByTagName("NextContinuationToken")[0]
      ?.textContent!,
    StartAfter: doc.getElementsByTagName("StartAfter")[0]?.textContent!,
  };
};
