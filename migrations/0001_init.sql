CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,            -- sha-256 of the article URL
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT,
  published_at INTEGER NOT NULL,  -- unix seconds
  fetched_at INTEGER NOT NULL,
  query TEXT,                     -- which search surfaced it
  sector TEXT,
  party TEXT,                     -- BN | PH | PN | GPS | GRS | Other | None
  sentiment TEXT,                 -- Positive | Neutral | Negative
  classified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_published ON items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_party ON items (party, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_sector ON items (sector, published_at DESC);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
