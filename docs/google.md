# Connect a client’s Google reporting accounts

The private agency workspace can connect several Google identities and map their GA4 properties, Search Console sites and Business Profile locations to clients. Each reporting resource can belong to one client per workspace. Client profiles can hold several separate storefront locations or properties. The code does not edit Google listings, websites or Analytics settings.

## First connection

1. Open **Connections** and copy the callback URL shown under Google setup. Use the deployed hostname. A localhost callback belongs in a separate development credential.
2. In the Google Cloud project used by the agency, enable the **Google Analytics Admin API**, **Google Analytics Data API** and **Google Search Console API**. For local listings, enable the **My Business Business Information API** and **Business Profile Performance API**. Check that the project has Business Profile API access and a usable quota before enabling the optional Business Profile permission.
3. Configure the application branding, audience and publishing status in [Google Auth Platform](https://console.cloud.google.com/auth/overview). External testing requires the intended Google identities to be test users. For external use with sensitive permissions, follow the verification requirements Google shows for the project. External testing can result in short-lived refresh grants. A verification submission can require a verified agency-owned domain, public homepage and privacy policy. Confirm domain ownership and a production callback before expanding external access. [Google verification guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
4. Create an OAuth client of type **Web application**. Paste the exact callback into **Authorized redirect URIs**. Save its client ID and secret in the dashboard’s Connections form. The form encrypts the secret server-side and never returns it. Alternatively, configure the two credentials as deployment secrets.
5. Open **Clients**, create the client and return to **Connections**. Choose **Connect Google account**, select Business Profile if needed, and complete the Google account chooser. Grant the reporting permissions needed for that identity. Connect each agency or client Google identity separately.
6. Choose the account, data source, accessible resource and destination client. Confirm the client spelling and resource ID. Run a sync and check the resource label, last observation, reporting date, Google error, and the expected time zone. Open GA4 realtime to see active users for the rolling 30-minute window.
7. If access expires, reconnect the same verified Google identity. Existing mappings are retained. Removing an account deletes its local refresh credential, mappings and report snapshots. Google’s account-level third-party grant can independently be removed in [Google Account connections](https://myaccount.google.com/connections).

## Host configuration

| Name | Configuration |
| --- | --- |
| DB | Cloudflare D1 binding. The Google module creates its tables idempotently. The host creates the workspace clients table first. |
| GOOGLE_REDIRECT_URI | Canonical HTTPS endpoint ending in /api/google/callback. HTTP is permitted only on localhost and 127.0.0.1 for development. The same value must be registered on the Google OAuth client. |
| GOOGLE_TOKEN_KEY | A cryptographically random 32-byte value encoded in Base64 or Base64url. A deployment admin provisions this secret and protects its backup. Replacing it makes earlier encrypted credentials unreadable. |
| GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET | Optional deployment-wide default OAuth app. Credentials saved by the owner take precedence in both interactive and unattended requests. |

The host authenticates visitors before invoking the Google handler and passes its stable account identifier. All account, mapping, state and report reads scope the query to that identity. OAuth state expires after ten minutes, must match the initiating owner and is consumed once. The authorization code uses S256 PKCE. Refresh tokens and workspace OAuth client secrets use AES-GCM with per-record random nonces and associated data scoped to the workspace and identity. Access tokens are used server-side during the request. To change the OAuth application while preserving the existing linkages would require a credential migration; the setup form currently requires disconnecting existing accounts before changing credentials.

## Reporting behavior

| Source | Data and date interpretation | Evidence of freshness |
| --- | --- | --- |
| GA4 daily | Sessions, active users and key events by property date for up to the previous 90 days ending yesterday. Users are daily active counts. Adding daily active users across dates is not unique period reach. Missing reporting dates remain absent. | Successful fetch timestamp, latest date returned and property time zone. Recent daily values can be revised by Google. |
| GA4 realtime | Active users for the latest 30 minutes from runRealtimeReport. | Separate observation timestamp and independent errors. Polling is limited to once per property per 55 seconds. A failed refresh retains the earlier observation and its original timestamp. |
| Search Console | Final web search clicks, impressions, CTR and average position across up to 90 days ending yesterday in Pacific time. Dates without returned data stay missing. | Final data state, latest returned date and successful fetch timestamp. CTR is a ratio; recalculate from summed clicks and impressions for a chosen period. |
| Business Profile | Authorized location details, available daily Maps/Search impression series, website clicks, call clicks and direction requests. The request covers the latest 28 completed dates using an India reporting boundary. A call click records an interaction, not a completed call. | Latest available daily metric and successful fetch timestamp. Cached raw Google content expires after 24 hours. An evicted cache can temporarily have no observations until the next sync. |
| AI referrals | The GA4 sessions report filters session source to named AI domains/subdomains and medium to referral. Known domains are listed in server/google-provider.js. This can miss direct or untagged visits and sources with another medium. | These counts identify measured referral sessions. AI answer mentions and citations are collected separately by the evidence workflow. |

A full pass refreshes up to five due bindings by default, prioritizing those least recently attempted. Further passes rotate through the backlog independently of whether older properties succeeded. Per-source leases prevent overlapping refreshes. A failed request preserves the previous successful report and updates the failure timestamp and reason. Daily retries have a five-minute per-binding cooldown. The parent application invokes daily and realtime passes separately. Periodic operation while the dashboard is closed depends on the host scheduler calling the application’s maintenance entry point.

Business Profile’s optional scope is business.manage because its APIs require that scope even for reads. The connector calls listing reads and reporting endpoints only. Stored Business Profile snapshots remain raw in a temporary cache. D1 keeps the selected resource ID and operational timestamps, not listing content or a derived historical warehouse. The display projects dated values at read time. Same-day impression totals include all four reporting surfaces only when all four have an observation. They are not unique people across surfaces.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Callback mismatch | Compare the displayed HTTPS URL and the exact authorized redirect URI in Google Cloud, including path and trailing slash. |
| Empty property list | Check the identity chosen in Google consent, its property/location access and the granted reporting scopes. A different signed-in Google account can have a different list. |
| Business Profile 403 or quota zero | Confirm project approval, enabled APIs and the user’s access to the location. Reconnect with the optional Business Profile permission. |
| Disconnected or expired authorization | Reconnect the same Google identity. Check app publishing status when testing-time grants repeatedly expire. |
| Account works but one source fails | Inspect that binding’s permissions and last error. Other sources continue syncing. Use the last successful fetch and last reporting date when evaluating a drop. |
| GA realtime and GA daily totals differ | Realtime reports a moving activity window. Compare a daily metric with the equivalent date range and definitions in GA4. |
| No AI referral row | Check the referrer domains and GA4 channel attribution. Absence of attributed traffic is inconclusive about AI visibility. |

## Official references

- [Google OAuth for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Analytics account discovery](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list)
- [GA4 daily reports](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport) and [realtime reports](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runRealtimeReport)
- [Search Console Search Analytics query](https://developers.google.com/webmaster-tools/v1/api_reference_index) and [report definitions](https://developers.google.com/webmaster-tools/v1/api_reference_index#Search_analytics)
- [Business Profile location discovery](https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations/list), [daily metrics](https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries) and [Business Profile policies](https://developers.google.com/my-business/content/policies)
