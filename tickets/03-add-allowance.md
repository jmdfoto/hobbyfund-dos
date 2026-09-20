# 03 — Add Allowance

Spec section 3.1.

## Behavior
- "Add allowance" button opens entry for a total amount, prefilled $50, editable.
- Slider or two linked number inputs split the total between Spend and Save; moving one updates the
  other live (e.g. "Spend $25.00 / Save $25.00").
- Deposits only ever land in Spend or Save — Invest is never a split option here.
- Confirming creates **one ledger entry per non-zero bucket** (a split deposit produces two entries,
  same timestamp, each tagged with its bucket, type "allowance").

## Validation
- Amount must be > $0 (spec section 6).

## Acceptance Criteria
- Entering $50 and confirming with default split creates two transactions: spend +25, save +25 (or
  whatever the current split is), both type "allowance", same ISO timestamp.
- Setting the slider fully to one side and confirming creates exactly one transaction (the zero-amount
  side is skipped).
- Cannot confirm with a $0 or negative total.
