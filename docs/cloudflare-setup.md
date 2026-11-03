# Moving HobbyFund to Cloudflare

This covers the one-time setup for running HobbyFund at **hobbyfund.app** on Cloudflare, with a
login screen and a shared database. Until you finish it, the Netlify site keeps working exactly as
before, using browser storage, so keep using it as normal.

How it fits together:

- **Worker** (`worker/`): serves the app and the `/api/*` endpoints.
- **D1** (`migrations/`): the database. It holds the ledger, who's allowed in, and an audit log.
- **Cloudflare Access**: the login screen. It emails a one-time code, and only emails on your
  list get in. The `users` table then decides each person's role:
  - `parent`: full control.
  - `child`: view only, enforced on the server.

## 1. Account and domain (in the browser)

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free plan).
2. Go to **Domains → Register Domains** and buy `hobbyfund.app`.
3. Open **Zero Trust** from the dashboard sidebar and choose the **Free** plan. When asked for a
   team name, pick anything (e.g. `hobbyfund`). Your team domain is then
   `hobbyfund.cloudflareaccess.com`.

## 2. Database (in a terminal, in this folder)

```bash
npx wrangler login                 # opens the browser to authorize
npx wrangler d1 create hobbyfund   # prints a database_id
```

Paste the printed `database_id` into `wrangler.jsonc`, replacing the `0000…` placeholder. Then:

```bash
npm run db:migrate:remote
```

Add the two people who may use the app, using your real addresses:

```bash
npx wrangler d1 execute hobbyfund --remote --command "INSERT INTO users (email, role) VALUES ('you@example.com', 'parent'), ('connor@example.com', 'child')"
```

## 3. Login screen (Cloudflare Access)

In **Zero Trust → Access → Applications**, choose **Add an application → Self-hosted**:

- **Application domain:** `hobbyfund.app`
- **Policy:** action **Allow**. Under *Include*, choose **Emails** and add the same two
  addresses.
- **Login methods:** keep **One-time PIN** (the emailed code).

After saving, open the application's settings and copy the **Application Audience (AUD) Tag**.
In `wrangler.jsonc`, set:

```jsonc
"ACCESS_TEAM_DOMAIN": "hobbyfund.cloudflareaccess.com",  // your team name
"ACCESS_AUD": "<the AUD tag>"
```

Neither value is secret. The Worker uses them to check that each request really came through
your login screen.

## 4. Deploy

```bash
npm run deploy
```

Open https://hobbyfund.app. You should get the email-code screen, then an empty ledger.

## 5. Bring your data over (when you're ready to switch)

1. On **hobbyfund.netlify.app**, in the browser you normally use, click **Export CSV**.
2. On **hobbyfund.app**, signed in as the parent, click **Import CSV** at the bottom and choose
   that file. The link only appears while the ledger is empty, and the import is refused
   otherwise, so it can't double up.
3. Check the balances match the old site.

After that, stop using the Netlify site. Pointing it at the new address is a separate step,
done once you're happy.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # pretend-login as parent@example.com
npm run db:migrate:local
npm run db:seed:local            # adds parent@example.com and child@example.com
npm run dev
```

To see Connor's view, set `DEV_AUTH_EMAIL=child@example.com` in `.dev.vars`. This fake login
only works on localhost and is ignored once Access is configured.
