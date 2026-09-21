# Deploying to Netlify

The app is a static build with no backend, so Netlify hosting is zero-config — `netlify.toml`
in the repo root already tells Netlify how to build it:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

There are two ways to get it live. Use the GitHub-connected method unless you just want a
one-off URL to test.

## Option A — Connect the GitHub repo (recommended)

This gives you auto-deploy: every push to `main` rebuilds and redeploys automatically.

1. Go to [app.netlify.com](https://app.netlify.com) and log in (or sign up — free tier is enough
   for this).
2. Click **Add new site → Import an existing project**.
3. Choose **GitHub** and authorize Netlify if prompted.
4. Select the `jmdfoto/hobbyfund-dos` repo.
5. Netlify reads `netlify.toml` and pre-fills:
   - Build command: `npm run build`
   - Publish directory: `dist`
   Leave these as-is.
6. Click **Deploy site**. First build takes ~30-60 seconds.
7. Netlify gives you a random URL like `random-name-123.netlify.app`. You can rename it under
   **Site settings → Domain management → Options → Edit site name**, or attach a real domain
   there later if you want one.

From now on, any `git push` to `main` triggers a new deploy automatically — no manual steps.

## Option B — Drag-and-drop (quick one-off, no auto-deploy)

Useful for a fast test without connecting GitHub.

```bash
npm run build
```

This produces a `dist/` folder. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and
drag that `dist` folder onto the page. Netlify uploads it and gives you a live URL immediately.
Re-running this manually is the only way to update the site with this method — it won't watch
your repo.

## Installing on your kid's phone

Once it's live on a Netlify URL:

1. Open the URL in the phone's browser (Safari on iOS, Chrome on Android).
2. **iOS Safari**: tap the Share icon → **Add to Home Screen**.
   **Android Chrome**: tap the ⋮ menu → **Add to Home screen** (or **Install app** if offered).
3. It now behaves like an installed app — its own icon, opens without browser chrome — with no
   App Store involved, which matches the spec's intent for a private family tool.

## Notes

- No environment variables are needed for v1 — everything (the ledger) lives in the browser's
  `localStorage`, so each device/browser has its own independent data. There's no shared backend,
  which means the parent's phone and the kid's phone will **not** see the same ledger unless you
  deliberately use the same device/browser for both.
- If v2 (live Alpaca investment value, spec section 9) gets built later, that will need a Netlify
  Function to hold the API key server-side — see `tickets/README.md` for why it's out of scope
  today. That part *would* need an environment variable (the Alpaca API key), set under
  **Site settings → Environment variables** in Netlify, never committed to the repo.
