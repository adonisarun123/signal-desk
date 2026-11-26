# Signal Desk by Monk Mantra

A private agency dashboard for client Analytics, Search Console, Business Profile, actionable health checks and AI answer evidence. The browser opens in a labelled sample workspace. Live records are stored in Neon Postgres behind the owner's Google sign-in. A Google Cloud OAuth web client and consent from each reporting account activate its data.

## Operate the dashboard

1. Open the live workspace and add a client with its brand name and primary domain.
2. Under Connections, configure the Google OAuth web client and authorize a reporting account. Choose the optional Business Profile scope for locations. Link each accessible property to its client.
3. Use the Overview for rolling active users and comparable reporting windows. The Signals page shows the dates, baseline and proposed next checks behind detected changes.
4. Record representative AI prompts and answers under AI visibility. Paid OpenAI web-search sampling is available only when configured and explicitly triggered. AI referral sessions are collected separately through GA4.

5. Keep each client's onboarding record (accountable operator, contact, key events, GA4 time zone) current. Assign, review and resolve signals with repair evidence. Log the weekly review on the client page. Offboard from the client page when an engagement ends.

See [the implementation scope and operating guide](docs/SCOPE.md), [what is built against it](docs/IMPLEMENTATION_STATUS.md), [Google activation](docs/google.md) and [the hourly operation](ops/HOURLY.md).

## Run and test

Use Node 22.13 or later. Install with `npm ci`. `npm test` runs the API, measurement, sign-in and interface regression suites against an in-memory SQLite adapter with provider fixtures; `npm run test:pg` runs the same suites against in-process PostgreSQL (PGlite) through the production database adapter. `npm run dev` starts Next.js on http://localhost:3000 and `npm run build` produces the Vercel build. The demo workspace requires no secrets.

## Hosting (Vercel + Neon)

- **App:** standard Next.js on Vercel. `public/` is the dashboard shell; `app/api/[...path]/route.ts` hands every API request to `server/router.js` on the Node.js runtime. Functions run in Singapore (`sin1`, next to the Neon database).
- **Database:** Neon Postgres via `DATABASE_URL`. `server/pg-d1.js` presents it to the server modules with the D1 interface they were written for (`prepare/bind/first/all/run`, `batch` as one transaction) and translates the few SQLite-only constructs. `npm run db:migrate` creates every table; the modules also bootstrap their tables idempotently on first use.
- **Sign-in:** Google sign-in with an email allowlist (`server/auth.js`). The session is an HMAC-signed, HttpOnly cookie, and identity is never read from request headers. Set `AUTH_SECRET`, `ALLOWED_EMAILS`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` and `AUTH_URL`, and register `https://<domain>/api/auth/callback` on the Google OAuth client.
- **Hourly check:** Vercel Cron (`vercel.json`) calls `/api/jobs/tick` at five past every hour with `Authorization: Bearer $CRON_SECRET`. Without a `CRON_SECRET` of 16+ characters the scheduled check is disabled. Hourly cron needs a Vercel Pro plan.
- **Moving data from the old D1 database:** export it to SQL, then `npm run db:import-d1 -- export.sql` (dry run) and `-- --commit`. Keep the old `GOOGLE_TOKEN_KEY`, and map your email to the old workspace id with `OWNER_ID_OVERRIDES`, or stored Google connections cannot be decrypted.

See `.env.example` for every variable. Locally, put them in `.env.local`.

## Keep GitHub in sync

This folder tracks https://github.com/adonisarun123/signal-desk on `main`. After committing, run `npm run sync`. It pulls and rebases remote changes, then pushes local commits.

## Source

- public/ holds the accessible dashboard shell, charts, sample interactions and client operations.
- server/ contains identity-scoped Google APIs, health rules, AI evidence, and scheduled operations.
- app/ provides the page and API entry points. db/ and drizzle/ contain the core schema and migrations.
- test/ exercises real request handlers against fixture providers. Local or staged provider success is distinct from successful live collection for a client.

Deploy private by default, preserve the encryption key across upgrades, and reconcile one client with its native reports before treating a reading as a production baseline.
