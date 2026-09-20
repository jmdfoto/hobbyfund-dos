# 02 — Ledger Engine (Data Model + Balance Derivation)

## Goal
Implement the single source of truth per spec section 4. Balances are **derived**, never stored
independently.

## Data shape
```
{
  kidName: string,
  matchRatio: number (default 1.0),
  transactions: [
    {
      id: string,
      date: ISO 8601 timestamp,
      type: "allowance" | "purchase" | "transfer" | "invest" | "match",
      bucket: "spend" | "save" | "invest",
      amount: number (positive = credit, negative = debit),
      note: string
    }
  ]
}
```
Design the model so a future `childId` field could be added without reshaping existing data (multiple
profiles are out of scope for v1 UI, per spec section 2/8, but the shape shouldn't fight it later).

## Derived balances (pure functions, no side effects)
- `spend_balance` = sum of amounts where bucket == spend
- `save_balance` = sum of amounts where bucket == save
- `invest_balance` = sum of amounts where bucket == invest
- `invest_contributed` = sum of amounts where bucket == invest and type == invest
- `invest_matched` = sum of amounts where bucket == invest and type == match

## Acceptance Criteria
- Given the example in spec section 4 (three rows: transfer/save/-20, invest/invest/+20,
  match/invest/+20), balance functions return save=-20 delta, invest=+40 total, contributed=20,
  matched=20.
- No function mutates transactions in place; all balance reads are pure recomputation from the array.
- matchRatio is read from config/state, not hardcoded in the invest calculation.
