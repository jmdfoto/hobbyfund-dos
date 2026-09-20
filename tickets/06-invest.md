# 06 — Invest (One-Way, Parent-Matched)

Spec section 3.4.

## Behavior
- "Invest" action: pick source bucket (Spend or Save).
- Enter amount; validate against source bucket balance.
- Confirming creates **three** ledger entries, same timestamp:
  1. debit from source bucket (type "transfer")
  2. credit to invest bucket for child's contribution (type "invest")
  3. credit to invest bucket for parent's match (type "match"), amount = contribution * matchRatio
- matchRatio is a configurable constant (default 1.0), read from state/config — never hardcoded per
  spec section 4/8.
- The match entry has no offsetting debit anywhere (parent money from outside the tracked fund).
- No "move back" action exists anywhere in the UI for Invest. It is append-only (spec section 6).
- Display: "Invested: $40.00 (you put in $20.00, matched $20.00)" using invest_contributed /
  invest_matched derived values.

## Validation
- Amount cannot exceed the chosen source bucket's balance.
- Amount must be > $0.

## Acceptance Criteria
- Investing $20 from Save (1:1 match) produces exactly the three-row example in spec section 4:
  transfer/save/-20, invest/invest/+20, match/invest/+20.
- Changing matchRatio to e.g. 0.5 changes only the match entry's amount, not the contribution entry.
- Grep/audit confirms no code path ever writes a negative amount with bucket == "invest".
