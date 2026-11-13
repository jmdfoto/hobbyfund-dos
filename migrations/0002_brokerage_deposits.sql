-- Real money the parent has actually moved into the brokerage account, recorded by hand.
-- Kept apart from ledger_transactions on purpose: an Invest ledger entry only *sets money
-- aside*; a deposit row is the claim that real money moved. pending = invest bucket − deposits.
CREATE TABLE brokerage_deposits (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL,
  child_id     TEXT NOT NULL,
  date         TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  note         TEXT NOT NULL DEFAULT '',
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at   TEXT
);

CREATE INDEX deposits_by_child ON brokerage_deposits (family_id, child_id, deleted_at, date);
