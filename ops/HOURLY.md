# Hourly client health check

This deployment is owner-private. The updater uses the Sites service credential for this exact private Site. A refresh never posts to clients or changes a Google property. Follow this procedure each run.

1. Obtain the current Site metadata using the linked project's get_site operation. Confirm the owner-private audience, the deployed origin, and service access. If the audience has changed, stop and notify the owner. Use the returned service credential in memory and discard it after the run. Never output or persist it.
2. POST an empty JSON object to /api/jobs/tick on the exact current_live_url origin, with Content-Type application/json and OAI-Sites-Authorization: Bearer <service credential>. A browser session is unnecessary. If access fails, report the failure. Do not write sample readings.
3. GET /api/jobs/status on that same origin with the same service header and verify the persisted result by startedAt. Records use UTC timestamps. If a run is running, allow time for completion and re-read. The lock deduplicates work inside the same UTC hour.
4. Notify Arun of new critical or warning signals, incomplete source reads or a job failure, with a link to /?workspace=live&view=signals. Include the counts and check time in Asia/Kolkata. If more bindings are queued, report the backlog as such. A run with zero connections supplies no performance verdict. Keep healthy, empty and repeated results quiet.

The scheduled writer processes bounded batches of Google bindings. Within each workspace it prioritises the oldest attempt and preserves previous readings after provider errors. Paid AI sampling always requires an explicit submission in the dashboard.
