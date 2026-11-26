# Signal Desk by Monk Mantra

A private agency dashboard for client Analytics, Search Console, Business Profile, actionable health checks and AI answer evidence. The browser opens in a labelled sample workspace. Live records are stored in D1 behind the authenticated owner's Sites identity. A Google Cloud OAuth web client and consent from each reporting account activate its data.

## Operate the dashboard

1. Open the live workspace and add a client with its brand name and primary domain.
2. Under Connections, configure the Google OAuth web client and authorize a reporting account. Choose the optional Business Profile scope for locations. Link each accessible property to its client.
3. Use the Overview for rolling active users and comparable reporting windows. The Signals page shows the dates, baseline and proposed next checks behind detected changes.
4. Record representative AI prompts and answers under AI visibility. Paid OpenAI web-search sampling is available only when configured and explicitly triggered. AI referral sessions are collected separately through GA4.

See [the implementation scope and operating guide](docs/SCOPE.md), [Google activation](docs/google.md) and [the hourly operation](ops/HOURLY.md).

## Run and test

Use Node 24 or later. Install with npm ci. Run the isolated API, measurement and interface regression suites with npm test. They use an in-memory SQLite adapter and provider fixtures. npm run build compiles the server Worker and client assets. npm run dev starts the Vinext development environment. The demo requires no secrets.

The tracked hosting manifest declares the DB binding. The hosted deploy applies the Drizzle migrations. For local live-mode development, build first and apply each drizzle/*.sql file in filename order with the local Wrangler D1 command documented below. The Google, alert and evidence modules bootstrap their own tables idempotently. Configure local secrets using ignored .dev.vars. See .env.example for field names. Sites provides identity headers on authenticated hosted requests. Self-hosters must provide a trusted identity gateway that strips client-supplied identity headers. Leave PRIVATE_SITE_JOBS disabled unless the endpoint is behind a verified owner-private access boundary.

    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_parched_harrier.sql

## Source

- public/ holds the accessible dashboard shell, charts, sample interactions and client operations.
- server/ contains identity-scoped Google APIs, health rules, AI evidence, and scheduled operations.
- app/ provides the page and API entry points. db/ and drizzle/ contain the core schema and migrations.
- test/ exercises real request handlers against fixture providers. Local or staged provider success is distinct from successful live collection for a client.

Deploy private by default, preserve the encryption key across upgrades, and reconcile one client with its native reports before treating a reading as a production baseline.
