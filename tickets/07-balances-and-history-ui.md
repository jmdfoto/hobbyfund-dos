# 07 — Balances & History UI

Spec section 5.

## Balance display
- Spend, Save, Invest shown as primary content. Invest may be visually secondary/smaller.
- A combined total shown secondarily (small line at top). Decide and clearly label whether it includes
  Invest or is Spend+Save only (recommendation: label it "Total ready to use" = Spend+Save, since
  Invest isn't accessible money — keep the label explicit either way).
- Plain child-facing language allowed in place of technical bucket names (e.g. "Ready to use" for
  Spend) — spec section 5 explicitly permits this.

## Action buttons
- Four always-visible, large-tap-target buttons: Add Allowance, Log a Purchase, Move Money, Invest.

## Ledger / history list
- Every transaction, most recent first.
- Each row: date, description, small bucket tag (Spend/Save/Invest), signed + colored amount (credits
  vs debits visually distinct).
- Match entries visually distinguishable from the child's own contributions (e.g. small "matched"
  label).

## Acceptance Criteria
- All four actions are reachable from the main screen without scrolling on a typical phone viewport.
- History list updates immediately after any action, newest entry on top.
- A match-type row is visually tagged differently from an invest-type row even though both show in
  the Invest bucket.
