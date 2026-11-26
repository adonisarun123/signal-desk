# Implementation status against the Scope and Operating Guide

Reviewed 26 November 2026 against `docs/SCOPE.md` (Monk Mantra Signal Desk Scope and Operating Guide).

## Pilot scope: built

| Guide requirement | Where it lives |
| --- | --- |
| Overview filtered by client and 7/28/90-day period | `public/overview.js` |
| GA4 rolling 30-minute active users (55-second refresh interval) | `server/google.js`, `server/google-provider.js` |
| Completed-period sessions, key events and AI referral sessions, compared only on matched days | `composeOverview` in `public/overview.js` |
| Weighted CTR (clicks ÷ impressions, unavailable on a zero denominator) and impressions-weighted position | `composeOverview` |
| Clients with agreed brand and canonical domain | `server/clients.js` |
| Onboarding register: accountable operator, contact, key events, GA4 time zone, notes | `server/clients.js`, client detail view |
| Offboarding: removes mappings, cached GBP content, signals, AI evidence and reviews | `DELETE /api/clients/:id` |
| Google OAuth per owner (PKCE, encrypted refresh tokens, reconnect on revoke) | `server/google-storage.js` |
| Discovery and exact-resource binding for GA4, GSC and GBP | `server/google.js` |
| Health rules: baseline, volume floors, thresholds, 3×MAD, freshness and GA4 hold-back | `server/health-rules.js` |
| Incident handling: acknowledge, assignee, review outcome, resolve with evidence, recovery, recurrence count, timeline | `server/health.js`, signal dialog |
| Signal-quality and resolution measures: open critical, unassigned, median time to acknowledge, outcomes | Signals page |
| AI evidence, manual or paid API (3 per UTC day, 1 web search, 900 output tokens) | `server/ai.js` |
| Prompt panels: branded vs discovery, language, city, engine and surface; rates filtered by type and period with numerator and denominator | `server/ai.js`, AI page |
| Failed or unusable runs logged separately and excluded from rates | `ai_failed_runs`, `POST /api/ai/failures` |
| Weekly review: risk, gain, next action, owner, due date, recovery metric | `/api/clients/:id/reviews` |
| CSV export of daily readings for reconciliation with native reports | Client detail → Export daily readings |
| Hourly authenticated job, lock deduplication, oldest-attempt-first rotation | `server/jobs.js`, `ops/HOURLY.md` |

## From the next engineering release: built

| Item | Notes |
| --- | --- |
| Locate a loss from the signal | `GET /api/google/breakdown`. GSC: page, query, country, device. GA4: landing page, channel group, device, country. Compares the signal date with the same weekday a week earlier by default, or any chosen day. Read on demand and not stored. |
| Scheduler beyond five bindings per pass | `SYNC_BATCH_LIMIT` (1–25, default 5). Interactive syncs stay at 5. |

## Deferred on purpose

These sit behind the guide's rollout gates and each needs a decision or an account first.

| Stage | What blocks it |
| --- | --- |
| External alert delivery (email/WhatsApp, quiet hours, retries, daily digest) | Choosing a delivery provider and confirming opted-in recipients |
| Team roles, assigned-client visibility, audit log, client logins | Moving beyond the owner-private pilot. Today the workspace is a single owner identity. |
| URL Inspection, sitemaps, CrUX/PageSpeed, uptime, CRM-qualified leads | Each needs its own source, lag, thresholds and accepted false-positive rate. CRM work needs the client's CRM. |
| Native Search Console generative-AI impression export | Google offers it only in the Search Console interface for eligible properties. There is no API to build against yet. |

## Operational caveats

- **Identity boundary.** Identity comes only from the signed session cookie issued after Google sign-in for an allowlisted email (`server/auth.js`). Request headers are never trusted for identity; the old `oai-authenticated-user-id` header is ignored. Removing an email from `ALLOWED_EMAILS` revokes its sessions.
- **Schema bootstrapping.** New columns and tables (client register, reviews, incident fields, AI panel fields, failed runs) are added idempotently at runtime, like the existing Google, health and AI tables. No manual migration is needed.
- **Acceptance.** Fixture tests are not reconciliation. Use the production acceptance checklist in `docs/SCOPE.md` with a real client grant before treating any reading as a baseline.
