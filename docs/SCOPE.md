# Signal Desk client health dashboard
**Monk Mantra | Product scope and operating guide | 26 November 2026**

Signal Desk gives Arun and the Monk Mantra team one place to see which client needs attention, what changed, how fresh the evidence is and what to check next. Use Google Analytics' rolling live count to inspect activity now. Use completed reporting periods to judge movement in traffic, search visibility and key events.

[Open the private Signal Desk workspace](https://monk-mantra-signal-desk.adonis-arun.chatgpt.site) (previous ChatGPT Sites deployment; the Vercel URL replaces it after cut-over)

## Starting with one client
Begin with a client whose Analytics and Search Console reports you can reconcile directly. For a clinic with a corporate website and two doctor websites, agree which domain belongs to each client record before connecting properties. A domain-wide Search Console property can include multiple subdomains. A shared GA4 property can include more than one website. Either can inflate a portfolio total if mapped twice.

| Workspace area | First useful action | Evidence of success |
| --- | --- | --- |
| Overview | Select a client and reporting period. | The chart, portfolio and signals reflect that selection. |
| Clients | Create a record using the agreed brand and website. | The record remains available after reopening the live workspace. |
| Connections | Authorize a Google identity and map an exact property or location to the client. | A successful sync shows a dated observation from that resource. |
| Signals | Read the source, change, baseline and suggested check. | The operator can decide who should investigate and acknowledge the item. |
| AI visibility | Record one fixed prompt and a verifiable answer. | The observed engine, mention and linked source can be reviewed together. |

**Release boundary.** The sample portfolio uses illustrative data. The live workspace starts with no authorized Google accounts. Enter the Google OAuth application credentials, complete account consent and map a property before relying on its metrics. Automated AI collection additionally needs a funded provider key. An owner-private release supports agency operations. Client-facing logins, scoped staff roles and external alert delivery belong to later phases.

## Reading the dates
A newly fetched response may describe an old day. Check both the time the application collected the data and the latest reporting date the provider supplied. A successful refresh alone does not establish current performance.

<!-- page -->

# What each source can establish

| Source | Data and grain | How to interpret it |
| --- | --- | --- |
| GA4 Realtime | Active users in a property's rolling 30-minute window. [1] | A timestamped snapshot useful for checking tag activity. Repeated snapshots overlap. Adding them would count a person repeatedly. |
| GA4 daily | Up to 90 completed dates of sessions, key events, daily active users and recognized AI referral sessions. [2] | Recent days can be revised as processing completes. Distinct users over a date range require a range-level report. |
| Search Console | Up to 90 dates of finalized web clicks, impressions, click-through rate and average position by verified property. [3] | Uses Pacific reporting dates. Missing dates and unavailable breakdowns carry uncertainty. Clicks and Analytics sessions measure different events. |
| Business Profile | Managed location details and up to 28 dates of Google metrics including call clicks, website clicks and direction requests where available. [4] | A click on a call button does not confirm that a person answered. Inspect the selected location and date. Keep the native metric definitions. |
| AI answer evidence | Dated prompt, observed answer, engine and source links. A run may mention the brand, cite its domain, both or neither. [7] | A sample describes that response. An untracked or failed run must stay outside the successful sample count. |
| Google generative AI | Eligible properties can inspect generative-AI impressions in Search Console's dedicated report. [8] | Overall Web data includes this traffic. Adding native AI impressions to total Web impressions would double count. The pilot's regular web series is not a dedicated AI feed. |

## Reporting periods and comparisons
Use equal-length periods and the same property, source and time zone. For an agency review, present a change only where both periods have comparable coverage. Weighted click-through rate is total clicks divided by total impressions. A zero denominator yields an unavailable rate. For average position, use the provider's range aggregation or an impressions-weighted summary of comparable rows. Do not average percentages across clients.

When a client's key events include phone taps, forms and WhatsApp clicks, the sum describes interactions. Define a qualified enquiry separately. Reconciling interactions to leads or consultations requires the client's CRM and a shared definition.

<!-- page -->

# Activating Google data

## Agency setup
1. Choose the operating Google Cloud project and its owner. Enable the Google Analytics Admin API for discovery, the Google Analytics Data API for reports and the Search Console API. Configure the OAuth consent screen and the project's audience. [5]
2. Create a Web application OAuth client. Copy the complete callback from Connections into Authorized redirect URIs. This deployment uses the private dashboard host followed by `/api/google/callback`. Match the scheme, host and path.
3. In Connections, open Configure Google OAuth and save the client ID and client secret. This deployment supplies the callback URI and token encryption key. An environment-configured client is an alternative for a self-hosted installation. Keep the encryption key stable across deployments.
4. For Business Profile, request project access and quota. Enable Business Profile Account Management, Business Information and Performance APIs. The identity must manage the location. Select the optional Business Profile permission during authorization. [4, 6]
5. For external users, complete Google's applicable publication or verification process. In external Testing, refresh tokens using reporting scopes generally expire after seven days. [5]

## First client sync
1. Open the live workspace. Create the client with the name used in reporting and the canonical domain. Record the GA4 property time zone, client contact and desired key events in the agency onboarding record.
2. Authorize the Google account that has access. Add another identity when the next client uses a different Google login. Use each account's consent screen and never request a client's password.
3. Discover resources and confirm the numeric GA4 property, exact Search Console domain or URL-prefix property, and GBP location ID or address. Confirm the property contains the intended site before binding it.
4. Run a sync. Compare one completed day's sessions and clicks with each native report using identical date, account, property, search type and filters. Check the raw dates if India and Pacific dates cross midnight differently.
5. Open the live counter after a test visit with consent enabled. Compare it against the native Realtime report's overlapping window. Ad blockers, consent choices and processing latency can affect observation.

**Secrets for alternate deployments.** Configure `GOOGLE_TOKEN_KEY` and `GOOGLE_REDIRECT_URI` server-side. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as host defaults or use the owner-specific form. Key changes require an explicit migration or reconnect.

**If only one source succeeds**, keep reviewing that source. Look up the missing service's account, resource permission, scope, quota and error before interpreting its chart.

<!-- page -->

# How Signal Desk evaluates health

The rules compare the latest usable daily observation against the client's own property history. They look for a change large enough to warrant investigation. A highlighted movement is evidence of a change. Attribution to a release, a ranking update, a holiday or lost demand requires a separate check.

| Stage | Rule used by the pilot |
| --- | --- |
| Choose a baseline | Prefer the median of at least three earlier observations on the same weekday in the previous 28 days. Otherwise use at least seven prior observed days in the previous 14. |
| Filter low counts | Minimum baseline and absolute movement are 25 and 15 for sessions, 15 and 8 for clicks, and 5 and 3 for key events. Small sites may have no eligible comparison. |
| Classify movement | For eligible data, a decline of at least 30% is a warning and at least 50% is critical. A gain of at least 35% can generate an opportunity. Magnitude must also reach three times the median absolute deviation of the historical sample. |
| Check collection | A failed connection, overdue successful sync or outdated reporting date requires investigation of collection first. Alert after 36 hours without a successful sync, or a latest GA4 date over three days old or GSC date over five days old. Hold GA4 observations back two property-calendar days for performance checks. |
| Manage an incident | Acknowledge to claim review, resolve after verifying the cause, and track recurrence if conditions later return. A recovered underlying condition can close an episode. |

**Worked example.** A property recorded 92, 100, 104 and 108 sessions on four earlier Mondays. Its weekday median is 102. The latest eligible Monday has 48 sessions. The decrease is 54 sessions and 52.9%. With fresh data and low historical variation, a critical signal merits a same-day investigation. Three sessions dropping to one on a small site would fail the volume gate even though the percentage decline is larger.

## Sources of false alarms
Festival closures in Bengaluru, cancelled clinic sessions, campaign launches and consent-banner changes can all shift demand or measurement. Compare the matching weekday, campaign schedule and affected property. A tracking outage can affect GA4 across channels while Google still reports normal search clicks. Persistent directional movement after a product change deserves a different investigation from a single anomalous day.

GBP uses connection health as its operational signal. Keep raw source metrics available per location under the provider's storage conditions. The health status reflects the measured signals and available evidence. [6]

<!-- page -->

# Evidence for AI visibility

## Three questions with different answers
**Did an answer name the client?** Record the full prompt and answer from an identified engine. Review obvious aliases, spelling variations, and false matches such as a doctor with the same surname. Retain a link or reproducible evidence where available. Avoid patient names or private clinical information in prompts and evidence.

**Did the answer use the client's site as a source?** Inspect the cited URLs or the provider's citation annotations. A directory profile can name a doctor without citing the doctor's site. Treat an answer-text reference, a clickable first-party citation and a third-party directory citation as separate observations. The classifier matches the normalized client name and links on its recorded domain or subdomains. A rebrand or alternate domain needs manual review. [7]

**Did anyone visit the site from an AI product?** GA4 can report sessions attributed to recognized AI referral sources. This describes visits whose attribution survives, even when the response itself is unavailable. A user can read an answer and never click, or visit through a route that loses the referrer. Keep attributed traffic and sampled answer evidence in separate measures.

## Running a comparable prompt panel
Start with a small panel for each client. For a Bengaluru spine practice, a branded diagnostic might ask “Where does Dr [name] consult?” A discovery prompt might ask “Which clinics in HSR Layout offer spine consultations?” Keep branded and unbranded questions separate when comparing visibility. Record language, city, product surface, exact wording and test date. Retest the same panel and keep model changes visible in the review log. For API sampling the operator configures a server-side OpenAI key. Manual recording is available without a provider subscription to this dashboard.

| Indicator | Calculation and reporting rule |
| --- | --- |
| Mention rate | Successful observations that name the client divided by successful observations in the same prompt panel and period. Show both numerator and denominator. |
| Citation rate | Successful observations with at least one confirmed first-party source link divided by successful observations. Count each answer once. |
| Example | Two mentions and one citation across five matched observations yield 40% mention rate and 20% citation rate. Five observations are too few for a market-wide claim. |
| Costs | Budget for model input and output plus web-search calls under the provider's current pricing. Automated checks require explicit runs and a configured key. The paid sampler allows three attempts per owner per UTC day, one web-search tool call and at most 900 output tokens per request. [7] |

For Google AI Overviews and AI Mode, also inspect the official Search Console impression report when eligible. It describes visibility of the site in Google features. Consumer ChatGPT, Gemini, Perplexity and an API-based web-search response have different surfaces. Record which one supplied the evidence. [8]

<!-- page -->

# Daily triage for the agency

| Observation | First check | Follow through |
| --- | --- | --- |
| Search clicks fall and impressions hold | Inspect queries and pages in native Search Console. Compare device, country, CTR and position for the affected period. | Review changed snippets, ranking mix and competitors. Log the URLs and date before adjusting a title. |
| Search impressions and clicks fall | Check coverage, robots directives, canonicals, sitemaps, releases and the affected page group. Verify native totals and delayed data. | Assign a technical check if indexability changed. Otherwise investigate demand, query mix and search visibility. |
| Sessions fall while Search Console holds | Review all-channel versus organic definitions, recent tag changes, cookie consent, redirects and filters. | Make one consented test visit. Record which event reached the intended property and when. |
| Key events fall while sessions hold | Test the form, phone and WhatsApp journeys. Check the event name, key-event designation, consent and recent releases. | Compare with aggregate CRM enquiries. Escalate a confirmed broken booking path immediately. |
| Google location counts change | Confirm the right branch, latest available date and same metric in native Business Profile. Check holiday hours and listing changes. | Have the authorized location manager review the listing and any suggested edits. |
| AI visibility rises or falls | Check prompt wording, city, engine, sample count, evidence and cited domains. | Retest the same panel and inspect the page used. Escalate inaccurate contact or practice information to the content owner. |

## Routine for Monk Mantra
**Start of day.** Check failed or overdue sources before reviewing performance changes. Assign urgent broken booking and enquiry journeys to a named operator in the team's existing task system. In the signal, acknowledge the item and retain the underlying property, observation date and comparison.

**After the repair.** Reproduce the patient or customer journey with a test identity. Verify the resulting event in the native tool and recheck the next eligible daily period. Record the fix, date and evidence against the incident before resolving.

**Weekly.** Summarize one material risk, one verified gain and one concrete next action per client. Record the owner, due date and metric that would show recovery. If the investigation found a useful change rather than an error, preserve the relevant page or campaign evidence so the team can reproduce it.

<!-- page -->

# Architecture and operational ownership

The browser displays a portfolio and sends authenticated requests to server-side API routes on Vercel. The server owns Google OAuth, property mapping, API requests and data normalization. A Neon Postgres database stores workspace records and integration state. Provider credentials and tokens belong at the server boundary. Sample data and live records have separate paths.

| Record | Purpose and boundary |
| --- | --- |
| Client and resource binding | Associate an owner, client, provider identity and upstream property or location. Use a resource ID to identify the binding. Property names can change. |
| Google connection | Track granted access and encrypted refresh credentials. A changed or revoked grant should lead to a reconnect workflow. |
| Observations and freshness | Preserve daily observations and the latest realtime snapshot with dates and fetch status. Keep no-data gaps visible and retain last success when a new fetch fails. |
| Signal | Identify client, resource, rule, severity, source evidence, state and dates. Repeated evaluation of a continuing condition should keep one item actionable. |
| AI evidence | Keep the prompt and answer associated with a client and engine. Preserve first-party citation evidence and the observation date. Audit spend against platform billing. |

## Handling interrupted operations
For a rejected authorization, check the exact redirect URI, selected account and consent status. For forbidden resources, check read access and API enablement. For quota exhaustion or an upstream outage, wait for recovery and retry a bounded set of bindings. Confirm that one failing client has not hidden successes elsewhere. A zero-result response, explicit zero observation and failed response are separate outcomes.

The intended cadence is hourly, using a linked scheduler to call the authenticated job. Confirm its activation and verify that it reaches the collector with the browser closed. Inspect its latest completion, latest provider observation and any per-binding failures. The Settings switch controls the workspace's participation. The scheduled collector takes up to five eligible source mappings per workspace per pass, prioritizing the oldest attempts. An hourly run with 15 mappings can take three runs to revisit all of them. If the schedule stalls, run a manual sync, verify the scheduler identity and clock, then confirm the next unattended run.

**Refresh windows.** A normal source sync has a five-minute per-mapping retry interval. The GA4 realtime path has a separate 55-second interval. Raw Business Profile data uses a 24-hour cache. Its reporting window is up to 28 days, which is separate from cache lifetime.

## Access and offboarding
Operate the pilot from the owner's private workspace. Store onboarding approvals, client contact, reporting scope and chosen locations in the agency's access register. On offboarding, remove the client's bindings and revoke obsolete Google access. Have the deployment administrator complete any remaining record deletion required by the agreement and verify the result. Before revoking a shared agency identity, identify every client that still uses it. Keep confirmation, owner and date in the register. For clinical websites, collect only aggregate traffic and operational counts.

<!-- page -->

# Rollout gates and expansion

| Stage | Owner and work | Exit condition |
| --- | --- | --- |
| One-client pilot | Arun selects a known client. An engineer configures secrets and a Google manager authorizes resources. | One agreed GA4 total and one GSC total reconcile to the native reports. Record the property, dates and filters. |
| Reliability exercise | An operator tests reconnect, repeated refresh, delayed data and recovery. Run the collector with the browser closed. | A provider failure shows a bounded error, preserves usable observations and allows another client to continue. A background run has a dated success record. |
| Portfolio rollout | Onboard a mix of a low-volume clinic, a busier site and a multi-location client. Review alerts daily for the first two weeks. | Every mapping has an owner. Repeated incidents are deduplicated. The team records false positives, useful gains and time to acknowledge. |
| External delivery | Add opted-in email or messaging destinations, per-client severity routing, quiet hours and delivery retries. | A test alert reaches only its intended recipient once, carries an actionable link and can be disabled. |
| Team and client access | Add agency roles, assigned-client visibility, audit logs, offboarding retention controls, backup and restore drills. | Client A cannot read or export client B data. Operators can delete or restore scoped records and rotate secrets safely. |
| Wider health signals | Add selected URL Inspection and sitemap checks, CrUX/PageSpeed field metrics, uptime probes and CRM-qualified lead reconciliation. | Each signal declares source, lag, thresholds, permissions and a specific action. The business accepts its false-positive rate. |

## Scope for the next engineering release
Prioritize three improvements after the pilot. Add GSC pages and queries, country and device filters, and a date-matched comparison so an analyst can locate a loss from the signal itself. Evaluate native generative-AI exports for properties with report access and retain their provenance.

Add a delivery queue with a stable incident identifier, retries, delivery status, a quiet-hours override for urgent service failures and a daily digest. Test each destination with a consenting recipient before enabling agency-wide delivery. Expand the scheduler beyond five bindings per pass as client count and quota allow.

For a clinic, add booking and missed-call outcomes only after the CRM can supply aggregate counts with agreed attribution windows. For ecommerce, use net orders and revenue after cancellations. Each addition needs reconciliation against the site's system of record.

<!-- page -->

# Production acceptance checklist

Take a screenshot or export of the native source, capture the dashboard value and record the same date, property and filters for every reconciliation. Keep discrepancies with a named owner until the agency can explain them.
1. Compare 7-day totals and at least two individual dates in the native Google interfaces. Verify dates around midnight and GA4 property time zones. Exercise an empty range, zero denominator and missing historical comparison.
2. Check two Google logins and at least two clients. Revoke one grant, replay a sync, remove one binding and verify each unaffected mapping. Confirm sample records never appear as live measurements.
3. Feed a known decline, an increase, a low-volume baseline and a stale source into the monitor. Verify severity, evidence, deduplication, acknowledgement, recovery and recurrence.
4. Record an answer mentioning the client without a first-party link and an answer citing the domain without naming the client. Confirm the two measures can diverge. Record an unsuccessful provider request separately from observations.
5. Establish a monthly spending ceiling with the provider, monitor web-search invocations and review the rate limits before expanding the prompt panel. Run a restoration drill and document a named operator before promising client service levels.

**Build verification.** Backend checks exercised the database schema, multiple-owner isolation, OAuth and provider-response fixtures, recovery and recurrence, scheduled-job deduplication and AI limits. Testing with a real client grant and reconciling native reports are acceptance steps for onboarding.

## Measurable targets for the pilot
Treat these as rollout targets, then measure actual performance on real accounts. Review the first 14 days with an operator who knows the accounts.

| Measure | Starting target | How to test it |
| --- | --- | --- |
| Coverage | Every onboarded client has a documented owner, agreed sources and confirmed bindings. | Inspect the register against Connections. Mark explicitly unavailable sources. |
| Freshness | At least 95% of scheduled collection windows complete or have a documented incident across the pilot. | Compare expected windows to job receipts. Examine provider lag separately. |
| Signal quality | Review every critical signal and categorize actionable, expected change or data issue. | Track review time and outcomes before setting a warning precision target. |
| Resolution | Critical booking-path failures have a named owner during the business day. | Record discovery, acknowledgement, repair and verification timestamps in the existing incident tracker. |

<!-- page -->

# Source notes and technical references

The source definitions below govern the meaning and availability of provider data. The alert thresholds and pilot rollout gates in this guide are product decisions. The agency can revisit them after comparing alerts against known site incidents and client outcomes.

**[1] Google Analytics realtime reporting.** Google documents the standard 30-minute reporting window, the longer optional window for Analytics 360, and the limited set of realtime metrics. [Realtime reporting guide](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-basics)

**[2] GA4 daily processing and quota.** Recent data can change while processing completes. Core and realtime reporting are distinct quota categories. [Analytics data freshness](https://support.google.com/analytics/answer/12233314) · [Data API quota](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)

**[3] Google Search Console performance.** The query reference defines reporting dates, aggregation and data state. Recent provisional data and finalized daily data require different interpretations. [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) · [Getting performance data](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)

**[4] Business Profile activation and metrics.** Access is project-specific. The performance service exposes Google-defined daily metrics and monthly keyword insights for eligible properties. [Prerequisites](https://developers.google.com/my-business/content/prereqs) · [Basic setup](https://developers.google.com/my-business/content/basic-setup) · [Performance API](https://developers.google.com/my-business/reference/performance/rest)

**[5] OAuth grants and expiry.** Google's web server flow documents consent, exact redirects, offline access and refresh tokens. External Testing projects have special expiry conditions. [Web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) · [Token expiry](https://developers.google.com/identity/protocols/oauth2#expiration)

**[6] Business Profile content use.** Google's API policies cover authorized listings and temporary storage of limited content. Review access, security, the 30-day storage condition and limits on processing stored content when extending the connector. [Business Profile API policies](https://developers.google.com/my-business/content/policies#content_storage)

**[7] OpenAI search evidence and charges.** The Responses API can return source URL annotations. Web-search tools and model usage have separate billing components. [Web search guide](https://developers.openai.com/api/docs/guides/tools-web-search) · [API pricing](https://developers.openai.com/api/docs/pricing)

**[8] Search generative AI performance.** Google offers a dedicated impression report where a property has sufficient data. Its ordinary Web report also includes visibility from AI features. [Generative AI performance report](https://support.google.com/webmasters/answer/16984139) · [AI features and websites](https://developers.google.com/search/docs/appearance/ai-features)

Prepared for Arun Mahendran and the Monk Mantra product, engineering and SEO teams. Sources checked 26 November 2026.
