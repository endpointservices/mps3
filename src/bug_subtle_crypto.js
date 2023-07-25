await crypto.subtle
  .generateKey(
    {
      name: "HMAC",
      hash: { name: "SHA-512" },
    },
    true,
    ["sign", "verify"]
  )
  .then((key) => crypto.subtle.sign("HMAC", key, new TextEncoder().encode("")))
  .then(console.log);
