-- EGM of the Day — D1 schema
-- Mirrors the key-value shape used by window.storage, so the frontend logic barely changes.

CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
