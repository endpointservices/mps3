import { S3 } from "@aws-sdk/client-s3";
import { expect, test, describe, beforeAll } from "bun:test";
import { MPS3, MPS3Config } from "mps3";
import { uuid } from "types";
import { CentralisedCausalSystem } from "./consistency";
import * as jsdom from "jsdom";
const dom = new jsdom.JSDOM("");

describe("mps3", () => {
  let s3: S3;
  let session = Math.random().toString(16).substring(2, 7);
  const s3Config = {
    endpoint: "http://127.0.0.1:9102",
    region: "eu-central-1",
    credentials: {
      accessKeyId: "mps3",
      secretAccessKey: "ZOAmumEzdsUUcVlQ",
    },
  };

  const configs: {
    label: string;
    config: MPS3Config;
  }[] = [
    {
      label: "useVersioning",
      config: {
        pollFrequency: 100,
        useVersioning: true,
        defaultBucket: `ver${session}`,
        s3Config: s3Config,
        parser: new dom.window.DOMParser(),
      },
    },
    {
      label: "noVersioning",
      config: {
        pollFrequency: 100,
        useChecksum: false,
        // useVersioning: false, // is the default
        defaultBucket: `nov${session}`,
        s3Config: s3Config,
        parser: new dom.window.DOMParser(),
      },
    },
  ];

  configs.map((variant) =>
    describe(variant.label, () => {
      beforeAll(async () => {
        s3 = new S3(variant.config.s3Config);

        await s3.createBucket({
          Bucket: variant.config.defaultBucket,
        });

        if (variant.config.useVersioning) {
          await s3.putBucketVersioning({
            Bucket: variant.config.defaultBucket,
            VersioningConfiguration: {
              Status: "Enabled",
            },
          });
        }
      });
      const getClient = (args?: { label?: string }) =>
        new MPS3({
          label: args?.label,
          ...variant.config,
        });
      test(
        "causal consistency all-to-all, single key",
        async (done) => {
          const key = "causal";
          await getClient().delete(key);

          const system = new CentralisedCausalSystem();
          const max_steps = 100;

          type Message = {
            sender: number;
            send_time: number;
          };
          // Setup all clients to forward messages to the observer
          const clients = [...Array(3)].map((_, client_id) => {
            const client = getClient({
              label: system.client_labels[client_id],
            });
            client.subscribe(key, (val) => {
              if (val) {
                const message: Message = <Message>val;
                system.observe({
                  ...message,
                  receiver: client_id,
                });
              }

              if (system.global_time < max_steps) {
                // Check facts are causally consistent so far
                const check_result = system.causallyConsistent();
                if (!check_result) {
                  console.error(system.grounding);
                  console.error(system.knowledge_base);
                }
                expect(check_result).toBe(true);

                // Write a new message
                system.observe({
                  receiver: client_id,
                  sender: client_id,
                  send_time: system.client_clocks[client_id] - 1,
                });

                expect(check_result).toBe(true);
                client.put(key, {
                  sender: client_id,
                  send_time: system.client_clocks[client_id] - 1,
                });
              } else if (system.global_time === max_steps) {
                clients.forEach((c) =>
                  c.manifests.forEach((m) => m.subscribers.clear())
                );
                done();
              }
            });
            return client;
          });
        },
        {
          timeout: 60 * 1000,
        }
      );
    })
  );
});