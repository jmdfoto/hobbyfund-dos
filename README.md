# Collection Fund

A three-bucket money tracker (Spend / Save / Invest) for teaching a kid saving, spending, and
investing habits, built from `tickets/README.md`'s spec breakdown. See that folder for the full
ticket-by-ticket build spec.

## Stack

- React + Vite, no backend (v1 is frontend-only, per spec).
- Persistence: browser `localStorage`. The transaction ledger is the single source of truth —
  all balances are derived from it, never stored independently.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Outputs a static site to `dist/`, deployable to Netlify (see `netlify.toml`) or any static host.

## Core rules enforced

- Purchases can only draw from Spend, and are blocked if they exceed the Spend balance.
- Spend ↔ Save transfers are freely reversible.
- Invest is one-way and append-only — no UI path can move money out of Invest.
- Investing applies a configurable match ratio (default 1:1) as a separate ledger entry with no
  offsetting debit, since it's the parent's money added from outside the tracked fund.
