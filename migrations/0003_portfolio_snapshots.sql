-- One row per market day: what Connor's portfolio was worth at the close, and how much real
-- money had been deposited by then. Keeping both lets the chart separate deposits from market
-- gains. Written by the Worker's daily cron; `mode` keeps paper and live histories apart.
CREATE TABLE portfolio_snapshots (
  family_id       TEXT NOT NULL,
  child_id        TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
  date            TEXT NOT NULL, -- market date in New York, YYYY-MM-DD
  value_cents     INTEGER NOT NULL,
  deposited_cents INTEGER NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (family_id, child_id, mode, date)
);
