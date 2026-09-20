# Collection Fund — Ticket Breakdown

Source: `collection-fund-spec.pdf`. Scope is v1 only (frontend, localStorage) — v2 (live Alpaca value) is
explicitly deferred per spec section 9 and not ticketed here.

Tickets are ordered by dependency. Each has acceptance criteria pulled directly from the spec so
"done" is checkable.

1. [01-project-setup.md](01-project-setup.md) — scaffold app, stack decision
2. [02-ledger-engine.md](02-ledger-engine.md) — data model, balance derivation, core validation
3. [03-add-allowance.md](03-add-allowance.md) — deposit flow
4. [04-log-purchase.md](04-log-purchase.md) — spend flow
5. [05-move-money.md](05-move-money.md) — Spend ↔ Save transfer
6. [06-invest.md](06-invest.md) — one-way invest + parent match
7. [07-balances-and-history-ui.md](07-balances-and-history-ui.md) — main screen, ledger list
8. [08-progress-charts.md](08-progress-charts.md) — Save-over-time and Invest-over-time visuals
9. [09-persistence.md](09-persistence.md) — localStorage, survives full restart
10. [10-polish-and-mobile.md](10-polish-and-mobile.md) — mobile-first pass, plain language, child name

Out of scope (per spec section 6/8): named savings goals, multiple child profiles (data model should
stay extensible), automatic/recurring allowance, real brokerage integration.
