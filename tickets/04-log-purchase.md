# 04 — Log a Purchase

Spec section 3.2.

## Behavior
- "Log a Purchase" opens a form: short description + amount.
- Deducts from Spend bucket only. Purchases can never draw from Save or Invest.
- Creates one ledger entry: type "purchase", bucket "spend", negative amount.

## Validation (must block, not just warn — spec section 6)
- Block if amount exceeds current Spend balance. Show inline message: "Not enough in Spend —
  $12.00 available." (uses the actual current balance in the message).
- Amount must be > $0.
- Description must be non-empty.

## Acceptance Criteria
- Attempting to log a $30 purchase with $12 Spend balance is blocked, with the exact-style inline
  message shown, and produces no transaction.
- Attempting to submit with an empty description is blocked.
- A valid purchase reduces spend_balance by exactly the entered amount and appears in the ledger.
