-- Accounts, organisations (tenants), sessions and login rate limiting.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,          -- stored lowercased
  name TEXT,
  password_hash TEXT NOT NULL,         -- PBKDF2-SHA256, hex
  salt TEXT NOT NULL,                  -- hex
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- owner | member
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,         -- sha-256 of the cookie token; the raw token is never stored
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts ON auth_attempts (key, ts);

-- Objectives now belong to an organisation.
ALTER TABLE objectives ADD COLUMN org_id TEXT;
CREATE INDEX IF NOT EXISTS idx_objectives_org ON objectives (org_id);
