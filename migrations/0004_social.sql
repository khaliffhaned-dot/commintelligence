-- Social channels (YouTube comments, Reddit) collected through their official APIs.
-- No author names or handles are stored. Posts are deleted after 14 days (data minimisation).
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,             -- 'yt:<commentId>' or 'rd:<postId>'
  channel TEXT NOT NULL,           -- youtube | reddit
  text TEXT NOT NULL,
  url TEXT NOT NULL,
  label TEXT,                      -- e.g. channel + video title, or r/malaysia
  published_at INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,  -- likes / upvotes
  sector TEXT,
  party TEXT,
  sentiment TEXT,
  audience TEXT,
  classified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_social_published ON social_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_channel ON social_posts (channel, published_at DESC);
