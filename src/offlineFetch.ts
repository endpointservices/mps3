import { createStore, get, set, del, keys } from "idb-keyval";

export const fetchFn = async (
  url_: string,
  init?: RequestInit
): Promise<Response> => {
  const url = new URL(url_);
  const params = new URLSearchParams(url.search);
  const headers = new Headers(init?.headers);

  let body;
  let status = 200;

  const segments = url.pathname.split("/");
  const bucket = segments[1];
  const key = segments.slice(2).join("/");

  console.log(init?.method, bucket, key);

  const db = createStore(bucket, "v0");

  console.log("offline", url_, init);
  if (params.get("list-type")) {
    const prefix = params.get("prefix") || "";
    const list = (await keys(db)).filter((k) => `${k}`.startsWith(prefix));
    body = `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>
${list.map((key) => `<Contents><Key>${key}</Key></Contents>`)}
</ListBucketResult>`;
  } else if (init?.method === "GET") {
    body = await get(key, db);
    if (body === undefined) {
      status = 404;
    }
  } else if (init?.method === "PUT") {
    body = await init.body;
    await set(key, body, db);
  } else if (init?.method === "DELETE") {
    await del(key, db);
  } else {
    throw new Error(`Unexpected request: ${url_} ${init?.method}`);
  }

  console.log(body, status);
  return new Response(body, { status });
};
