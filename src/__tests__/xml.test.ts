import { expect, test, describe } from "bun:test";
import { parseListObjectsV2CommandOutput } from "../xml";

describe("XML parser", () => {
  test("parseListObjectsV2CommandOutput example", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <ListBucketResult>
           <IsTruncated>false</IsTruncated>
           <Contents>
              <ChecksumAlgorithm>checksum</ChecksumAlgorithm>
              ...
              <ETag>1</ETag>
              <Key>key</Key>
              <LastModified>timestamp</LastModified>
              <Owner>
                 <DisplayName>string</DisplayName>
                 <ID>string</ID>
              </Owner>
              <RestoreStatus>
                 <IsRestoreInProgress>boolean</IsRestoreInProgress>
                 <RestoreExpiryDate>timestamp</RestoreExpiryDate>
              </RestoreStatus>
              <Size>integer</Size>
              <StorageClass>string</StorageClass>
           </Contents>
           ...
           <Name>name</Name>
           <Prefix>prefix</Prefix>
           <Delimiter>deliminator</Delimiter>
           <MaxKeys>100</MaxKeys>
           <CommonPrefixes>
              <Prefix>commonprefix</Prefix>
           </CommonPrefixes>
           ...
           <EncodingType>encoding</EncodingType>
           <KeyCount>2</KeyCount>
           <ContinuationToken>contoken</ContinuationToken>
           <NextContinuationToken>nexttoken</NextContinuationToken>
           <StartAfter>startafter</StartAfter>
        </ListBucketResult>`;
    const parsed = parseListObjectsV2CommandOutput(xml, parser);
    expect(parsed).toEqual({
      IsTruncated: false,
      Contents: {
        ChecksumAlgorithm: "checksum",
        ETag: "1",
        Key: "key",
        LastModified: "timestamp",
        Owner: {
          DisplayName: "string",
          ID: "string",
        },
        RestoreStatus: {
          IsRestoreInProgress: "boolean",
          RestoreExpiryDate: "timestamp",
        },
        Size: "integer",
        StorageClass: "string",
      },
      Name: "name",
      Prefix: "prefix",
      Delimiter: "deliminator",
      MaxKeys: 100,
      CommonPrefixes: [
        {
          Prefix: "commonprefix",
        },
      ],
      EncodingType: "encoding",
      KeyCount: 2,
      ContinuationToken: "contoken",
      StartAfter: "startafter",
      NextContinuationToken: "nexttoken",
    });
  });


  test("parseListObjectV2 minio example", () => {
    const xml `<?xml version="1.0" encoding="UTF-8"?>
    <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>ver6a24</Name><Prefix>manifest.json</Prefix><KeyCount>2</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><Contents><Key>manifest.json</Key><LastModified>2023-08-25T19:34:04.316Z</LastModified><ETag>&#34;fb2a3ed15fa6e7ced42dc00d50132e62&#34;</ETag><Size>16</Size><StorageClass>STANDARD</StorageClass></Contents><Contents><Key>manifest.json@01692992046294_ac</Key><LastModified>2023-08-25T19:34:04.306Z</LastModified><ETag>&#34;6de2d545ee848a433040e045d0ed146f&#34;</ETag><Size>230</Size><StorageClass>STANDARD</StorageClass></Contents></ListBucketResult>`

    const parsed = parseListObjectsV2CommandOutput(xml, parser);
    expect(parsed).toEqual({
      IsTruncated: false,
      Contents: {
        ChecksumAlgorithm: "checksum",
        ETag: "1",
        Key: "key",
        LastModified: "timestamp",
        Owner: {
          DisplayName: "string",
          ID: "string",
        },
        RestoreStatus: {
          IsRestoreInProgress: "boolean",
          RestoreExpiryDate: "timestamp",
        },
        Size: "integer",
        StorageClass: "string",
      },
      Name: "name",
      Prefix: "prefix",
      Delimiter: "deliminator",
      MaxKeys: 100,
      CommonPrefixes: [
        {
          Prefix: "commonprefix",
        },
      ],
      EncodingType: "encoding",
      KeyCount: 2,
      ContinuationToken: "contoken",
      StartAfter: "startafter",
      NextContinuationToken: "nexttoken",
    });
  })
});