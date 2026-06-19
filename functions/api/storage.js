// Cloudflare Pages Function: /api/storage
// Replaces Claude's window.storage with a simple key-value API backed by D1.
// Routes:
//   GET    /api/storage?key=...          -> { key, value }
//   POST   /api/storage  { key, value }  -> { key, value }
//   DELETE /api/storage?key=...          -> { key, deleted: true }
//   GET    /api/storage/list?prefix=...  -> { keys: [...] }
//
// Note: this app only uses two shared keys ('egm:cases-index' and
// 'egm:post-passcode'), so we don't need per-user auth here — everyone
// reads/writes the same small set of keys, same as the SHARED=true
// storage calls did on claude.ai.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const db = env.DB;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    if (url.pathname.endsWith("/list")) {
      const prefix = url.searchParams.get("prefix") || "";
      const { results } = await db
        .prepare("SELECT key FROM kv_store WHERE key LIKE ?")
        .bind(prefix + "%")
        .all();
      return json({ keys: results.map((r) => r.key) }, cors);
    }

    if (request.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "key required" }, cors, 400);
      const row = await db
        .prepare("SELECT key, value FROM kv_store WHERE key = ?")
        .bind(key)
        .first();
      if (!row) return json(null, cors, 404);
      return json({ key: row.key, value: row.value }, cors);
    }

    if (request.method === "POST") {
      const body = await request.json();
      if (!body || !body.key) return json({ error: "key required" }, cors, 400);
      await db
        .prepare(
          "INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?) " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
        )
        .bind(body.key, body.value, Date.now())
        .run();
      return json({ key: body.key, value: body.value }, cors);
    }

    if (request.method === "DELETE") {
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "key required" }, cors, 400);
      await db.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
      return json({ key, deleted: true }, cors);
    }

    return json({ error: "method not allowed" }, cors, 405);
  } catch (err) {
    return json({ error: String(err) }, cors, 500);
  }
}

function json(data, extraHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
