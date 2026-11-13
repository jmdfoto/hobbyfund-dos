-- Every order the parent asks HobbyFund to place, written BEFORE it is sent to the broker.
-- client_order_id is unique here and at the broker, so a double-tap, retry or dropped
-- connection can never place the same order twice: a repeat either hits this UNIQUE
-- constraint or is rejected by the broker as a duplicate id.
CREATE TABLE order_requests (
  id               TEXT PRIMARY KEY,
  family_id        TEXT NOT NULL,
  child_id         TEXT NOT NULL,
  mode             TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
  client_order_id  TEXT NOT NULL UNIQUE,
  symbol           TEXT NOT NULL,
  side             TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  -- Dollar orders carry notional_cents; "sell everything" carries the share qty instead.
  notional_cents   INTEGER CHECK (notional_cents IS NULL OR notional_cents > 0),
  qty              TEXT,
  -- pending_submit → submitted → filled | canceled | expired | rejected; failed = never reached
  -- the broker; unknown = sent but the answer was lost (resolved by the next sync).
  status           TEXT NOT NULL,
  broker_order_id  TEXT,
  broker_status    TEXT,
  filled_qty       TEXT,
  filled_avg_price TEXT,
  error            TEXT,
  market_date      TEXT NOT NULL, -- New York date the order was requested, for the daily limit
  requested_by     TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX orders_by_child ON order_requests (family_id, child_id, mode, created_at);
