import { OMap } from "OMap";
import { MPS3 } from "mps3";
import * as time from "time";
import { OperationQueue } from "operationQueue";
import {
  DeleteValue,
  ResolvedRef,
  VersionId,
  countKey,
  url,
  uuid,
} from "types";
import { JSONValue } from "json";
import { UseStore } from "idb-keyval";
import { ManifestState } from "manifestState";

class Subscriber {
  queue = Promise.resolve();

  constructor(
    public ref: ResolvedRef,
    public handler: (value: JSONValue | DeleteValue) => void,
    public lastVersion?: VersionId
  ) {}

  notify(
    service: MPS3,
    version: VersionId | undefined,
    content: Promise<JSONValue | DeleteValue>
  ) {
    this.queue = this.queue
      .then(() => content)
      .then((response) => {
        if (version !== this.lastVersion) {
          service.config.log(
            `${service.config.label} NOTIFY ${url(this.ref)} ${version}`
          );
          this.lastVersion = version;
          this.handler(response);
        }
      });
  }
}

export class Manifest {
  session_id = uuid().substring(0, 3);
  writes = 0;
  subscribers = new Set<Subscriber>();
  poller?: Timer;
  pollInProgress: boolean = false;

  manifestState: ManifestState = new ManifestState(this);
  operationQueue = new OperationQueue();

  constructor(public service: MPS3, public ref: ResolvedRef) {
    console.log("Create manifest", url(ref));
  }
  load(db: UseStore) {
    this.manifestState.restore(db);
    this.operationQueue.restore(
      db,
      async (
        values: Map<ResolvedRef, JSONValue | DeleteValue>,
        label?: string
      ) => {
        if (!label) {
          // this write has not been attempted at all
          // we do a write from scratch
          await this.service._putAll(values, {
            manifests: [this.ref],
            await: "local",
            isLoad: true,
          });
        } else {
          // the content was uploaded, but we don't know if the manifest was
          // so we do a manifest write
          await this.updateContent(
            values,
            Promise.resolve(
              new Map<ResolvedRef, VersionId>([[this.ref, label]])
            ),
            {
              await: "local",
              isLoad: true,
            }
          );
        }
      }
    );
  }
  observeVersionId(versionId: VersionId) {
    this.operationQueue.confirm(versionId);
  }

  async poll() {
    if (this.pollInProgress) return;
    this.pollInProgress = true;

    if (this.subscriberCount === 0 && this.poller) {
      clearInterval(this.poller);
      this.poller = undefined;
    }
    if (this.subscriberCount > 0 && !this.poller) {
      this.poller = setInterval(
        () => this.poll(),
        this.service.config.pollFrequency
      );
    }

    const state = await this.manifestState.getLatest();

    if (state === undefined) {
      this.pollInProgress = false;
      return; // no changes
    }

    // calculate which values are set by optimistic updates
    const mask: OMap<ResolvedRef, JSONValue | DeleteValue> =
      await this.operationQueue.flatten();

    this.subscribers.forEach(async (subscriber) => {
      if (mask.has(subscriber.ref)) {
        // console.log("mask", url(subscriber.ref));
        subscriber.notify(
          this.service,
          "local",
          Promise.resolve(mask.get(subscriber.ref))
        );
      } else {
        const fileState = state.files[url(subscriber.ref)];
        if (fileState) {
          const content = this.service._getObject<any>({
            operation: "GET_CONTENT",
            ref: subscriber.ref,
            version: fileState.version,
          });
          subscriber.notify(
            this.service,
            fileState.version,
            content.then((res) => res.data)
          );
        } else if (fileState === null) {
          subscriber.notify(
            this.service,
            undefined,
            Promise.resolve(undefined)
          );
        }
      }
    });
    this.pollInProgress = false;
  }

  updateContent(
    values: Map<ResolvedRef, JSONValue | DeleteValue>,
    write: Promise<Map<ResolvedRef, VersionId | DeleteValue>>,
    options: {
      await: "local" | "remote";
      isLoad: boolean;
    }
  ): Promise<unknown> {
    // Manifest must be ordered by client operation time
    const manifest_version = 
      time.timestamp(this.service.config.clockOffset) +
      "_" +
      this.session_id +
      "_" +
      countKey(this.writes++);

    const localPersistence = this.operationQueue.propose(
      write,
      values,
      options.isLoad
    );
    const remotePersistency = localPersistence.then(async () => {
      try {
        const update = await write;
        const state = await this.manifestState.getLatest();
        state.previous = this.manifestState.authoritative_key;
        state.update = {
          files: {},
        };

        for (let [ref, version] of update) {
          const fileUrl = url(ref);
          if (version) {
            const fileState = {
              version: version,
            };
            state.update.files[fileUrl] = fileState;
          } else {
            state.update.files[fileUrl] = null;
          }
        }
        // put versioned write
        const manifest_key = this.ref.key + "@" + manifest_version;
        this.operationQueue.label(write, manifest_version, options.isLoad);

        await this.service._putObject({
          operation: "PUT_MANIFEST",
          ref: {
            key: manifest_key,
            bucket: this.ref.bucket,
          },
          value: state,
        });
        // update pollers with write to known location
        const response = await this.service._putObject({
          operation: "PUT_POLL",
          ref: {
            key: this.ref.key,
            bucket: this.ref.bucket,
          },
          value: this.manifestState.authoritative_key, // indicates how far we need to look back
        });

        this.poll();
        return response;
      } catch (err) {
        console.error(err);
        this.operationQueue.cancel(write, options.isLoad);
        throw err;
      }
    });
    if (options.await === "local") {
      return localPersistence;
    } else {
      return remotePersistency;
    }
  }

  async getVersion(ref: ResolvedRef): Promise<string | undefined> {
    return (await this.manifestState.getLatest()).files[url(ref)]?.version;
  }

  subscribe(
    keyRef: ResolvedRef,
    handler: (value: JSONValue | undefined) => void
  ): () => void {
    this.service.config.log(
      `SUBSCRIBE ${url(keyRef)} ${this.subscriberCount + 1}`
    );
    const sub = new Subscriber(keyRef, handler);
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }
}
