# Hourly client health check

Vercel Cron runs the check at five past every hour (`vercel.json`). It sends `GET /api/jobs/tick` with `Authorization: Bearer $CRON_SECRET`; the endpoint refuses any request without that secret, and the check is disabled while `CRON_SECRET` is unset or shorter than 16 characters. A refresh never posts to clients or changes a Google property.

- **Status:** a signed-in owner can read `GET /api/jobs/status`. Records use UTC timestamps; the lock deduplicates work inside the same UTC hour, so a retried or duplicated cron delivery is harmless.
- **Manual run:** `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/jobs/tick`.
- **Review:** open `/?workspace=live&view=signals` for new critical or warning signals, incomplete source reads or job failures. A run with zero connections supplies no performance verdict. Vercel's Cron Jobs page and function logs show each invocation.
- **Duration:** the API route allows up to 300 seconds (Vercel Pro). The writer processes bounded batches of Google bindings (`SYNC_BATCH_LIMIT`, 1-25, default 5). Within each workspace it prioritises the oldest attempt and preserves previous readings after provider errors. If more bindings are queued, the next hour continues the backlog.

Paid AI sampling always requires an explicit submission in the dashboard.
