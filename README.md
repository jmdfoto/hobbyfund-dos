# Collection Fund

A three-bucket money tracker (Spend / Save / Invest) for teaching a kid saving, spending, and
investing habits, built from `tickets/README.md`'s spec breakdown. See that folder for the full
ticket-by-ticket build spec.

## Stack

- React + Vite frontend.
- Backend: a Cloudflare Worker (`worker/`) with a D1 database (`migrations/`), behind Cloudflare
  Access for login. Parent accounts can make changes; child accounts are view-only. The Worker
  validates every change with the same `src/lib/ledger.js` rules the browser uses.
- The transaction ledger is the single source of truth: all balances are derived from it, never
  stored independently.
- Without a backend (the old Netlify site), the same build falls back to browser `localStorage`.

See [docs/cloudflare-setup.md](docs/cloudflare-setup.md) for setup and local development.

## Develop

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local && npm run db:seed:local
npm run dev
```

## Build

```bash
npm run build
```

Outputs the site to `dist/client/` and the Worker to `dist/hobbyfund/`. `npm run deploy` builds
and deploys to Cloudflare. Netlify (see `netlify.toml`) still serves `dist/client/` as a
localStorage-only site.

## Core rules enforced

- Purchases can only draw from Spend, and are blocked if they exceed the Spend balance.
- Spend ↔ Save transfers are freely reversible.
- Invest is one-way and append-only — no UI path can move money out of Invest.
- Investing applies a configurable match ratio (default 1:1) as a separate ledger entry with no
  offsetting debit, since it's the parent's money added from outside the tracked fund.
