# 09 — Persistence

Spec section 7 & 10.1.

## Behavior
- All state (kidName, matchRatio, transactions) persists to browser localStorage on every change.
- On load, hydrate state from localStorage if present; otherwise initialize empty state
  (kidName default, matchRatio 1.0, transactions []).

## Acceptance Criteria
- Perform several actions, then do a **full browser restart** (not just a soft refresh/HMR reload) —
  ledger and balances are unchanged. This is called out explicitly in spec section 10.1 as the bar to
  clear before calling v1 done.
- Clearing localStorage resets to a clean empty state without crashing.
