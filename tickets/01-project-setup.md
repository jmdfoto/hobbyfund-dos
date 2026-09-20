# 01 — Project Setup

## Goal
Scaffold the app per spec section 10.1: frontend-only, no backend for v1.

## Decisions
- Stack: React + Vite (spec explicitly allows this or a plain HTML/JS file; React+Vite chosen for
  component structure given multiple forms/modals and future v2 extensibility).
- Persistence: browser localStorage (spec section 7 & 10.1).
- No routing needed — single screen app.

## Acceptance Criteria
- `npm run dev` launches the app locally.
- `npm run build` produces a static bundle deployable to Netlify (spec 10.1) with no backend.
- Project structure has clear separation between the ledger engine (pure functions, testable) and UI
  components, so v2 (section 9) can later add a fetched "current value" number without touching
  ledger logic.
