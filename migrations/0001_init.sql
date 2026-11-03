-- Phase 0 schema. Money is stored as integer cents; the API converts to dollars at the boundary.
-- family_id / child_id are constant ('default') for now so multiple families stay possible later.

-- Who may use the app, and with what role. Access decides who can log in at all;
-- this table decides what a logged-in email is allowed to do.
CREATE TABLE users (
  email      TEXT PRIMARY KEY COLLATE NOCASE,
  family_id  TEXT NOT NULL DEFAULT 'default',
  role       TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE settings (
  family_id      TEXT NOT NULL,
  child_id       TEXT NOT NULL,
  kid_name       TEXT NOT NULL DEFAULT 'Collector',
  match_ratio    REAL NOT NULL DEFAULT 1.0,
  -- Bumped on every ledger write; writes are guarded on it so concurrent requests can't both
  -- pass validation against the same balances.
  ledger_version INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, child_id)
);

INSERT INTO settings (family_id, child_id) VALUES ('default', 'default');

CREATE TABLE ledger_transactions (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL,
  child_id     TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  date         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('allowance', 'purchase', 'transfer', 'invest', 'match')),
  bucket       TEXT NOT NULL CHECK (bucket IN ('spend', 'save', 'invest')),
  amount_cents INTEGER NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at   TEXT,
  -- Invest is one-way: nothing may ever take money out of it.
  CHECK (NOT (bucket = 'invest' AND amount_cents < 0))
);

CREATE INDEX ledger_by_child ON ledger_transactions (family_id, child_id, deleted_at, seq);

CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  -- Client-supplied id for the submit; UNIQUE so a double-submitted form is applied once.
  request_id  TEXT UNIQUE,
  details     TEXT
);
