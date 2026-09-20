# 05 — Move Money (Spend ↔ Save)

Spec section 3.3.

## Behavior
- Direction toggle: Spend → Save, or Save → Spend.
- Freely reversible either direction; never touches Invest.
- Enter an amount; validate against source bucket balance.
- Creates two linked ledger entries, same timestamp: a debit from source, a credit to destination
  (type "transfer" on both).

## Validation
- Amount cannot exceed source bucket balance.
- Amount must be > $0.

## Acceptance Criteria
- Moving $10 Spend → Save with $10.01+ available succeeds, creating spend -10 / save +10, both type
  "transfer", same timestamp.
- Moving more than the source balance is blocked.
- No path in this flow can touch the invest bucket.
