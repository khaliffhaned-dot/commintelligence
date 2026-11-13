-- Track which articles have a vector in the Vectorize index (semantic search).
ALTER TABLE items ADD COLUMN embedded INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_items_embedded ON items (embedded, published_at DESC);
