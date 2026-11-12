-- Barcelona Principles 4.0 support: stakeholder audience tagging + measurable objectives.
ALTER TABLE items ADD COLUMN audience TEXT;
CREATE INDEX IF NOT EXISTS idx_items_audience ON items (audience, published_at DESC);

CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,        -- volume | positive_share | negative_share | net_sentiment | share_of_voice
  comparator TEXT NOT NULL,    -- atleast | atmost
  target REAL NOT NULL,
  party TEXT,                  -- optional filter
  sector TEXT,                 -- optional filter
  audience TEXT,               -- optional filter
  days INTEGER NOT NULL DEFAULT 30,
  created_at INTEGER NOT NULL
);
