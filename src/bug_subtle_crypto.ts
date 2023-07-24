const encoder = new TextEncoder();
const run = async () => {
  console.log("begin");
  const key = "20230723";
  const string = "20230723";
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );

  await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(string));
  console.log("done");
};

run();
