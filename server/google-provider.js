// Google requests use fixed service hosts. Resource names only occupy designated path segments.
export const scopes = {
  ga4: 'https://www.googleapis.com/auth/analytics.readonly',
  gsc: 'https://www.googleapis.com/auth/webmasters.readonly',
  gbp: 'https://www.googleapis.com/auth/business.manage'
};
export class GoogleIssue extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const issue = (status, code, message) => new GoogleIssue(status, code, message);
export const nowIso = () => new Date().toISOString();
const gscRoot = 'https://www.googleapis.com/webmasters/v3/sites';
const gaAdmin = 'https://analyticsadmin.googleapis.com/v1beta';
const gaData = 'https://analyticsdata.googleapis.com/v1beta';
const gbpInfo = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const gbpPerformance = 'https://businessprofileperformance.googleapis.com/v1';
const profileFields = 'name,title,websiteUri,phoneNumbers,storefrontAddress,categories,openInfo,regularHours,metadata';
const referralSources = ['chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'claude.ai', 'gemini.google.com', 'copilot.microsoft.com', 'copilot.com', 'grok.com', 'deepseek.com'];
const aiRegex = '([a-z0-9-]+\\.)*(' + referralSources.map(x => x.replaceAll('.', '\\.')).join('|') + ')';
const gbpMetrics = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS','BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS','BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'CALL_CLICKS','WEBSITE_CLICKS','BUSINESS_DIRECTION_REQUESTS'
];

export function checkSource(source) {
  if (!Object.hasOwn(scopes, source)) throw issue(400, 'INVALID_SOURCE', 'Choose Analytics, Search Console or Business Profile.');
}
export function checkResource(source, resource) {
  const valid = typeof resource === 'string' && resource.length <= 2048 && (
    (source === 'ga4' && /^properties\/[0-9]+$/.test(resource)) ||
    (source === 'gbp' && /^locations\/[0-9]+$/.test(resource)) ||
    (source === 'gsc' && /^(?:https?:\/\/[^\s]+|sc-domain:[^/\s]+)$/i.test(resource)));
  if (!valid) throw issue(400, 'INVALID_RESOURCE', 'Choose a Google resource from the list.');
}
export async function googleFetch(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {...options, redirect: 'error', signal: AbortSignal.timeout(12000)});
  } catch {
    throw issue(503, 'GOOGLE_UNREACHABLE', 'Google did not respond. Retry the sync shortly.');
  }
  const payload = await response.json().catch(() => null);
  if (response.ok) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw issue(502,'GOOGLE_INVALID_RESPONSE','Google returned an unreadable report. Retry the sync shortly.');
    return payload;
  }
  const code = payload?.error?.status || payload?.error;
  const reasons = payload?.error?.errors?.map(x => x.reason) || [];
  const details = payload?.error?.details?.map(x => x.reason) || [];
  if (code === 'invalid_grant') throw issue(401,'RECONNECT','Google authorization expired or was revoked. Reconnect this Google account.');
  if (code === 'invalid_client') throw issue(503,'GOOGLE_SETUP','Google rejected the OAuth client. Check the configured client ID and secret.');
  if (response.status === 429 || code === 'RESOURCE_EXHAUSTED' || reasons.some(x => /quota|ratelimit/i.test(x)))
    throw issue(429,'GOOGLE_QUOTA','Google quota reached. Retry later or review the API quota for this project.');
  if (details.includes('SERVICE_DISABLED') || reasons.includes('accessNotConfigured'))
    throw issue(403,'API_DISABLED','Enable this API in the Google Cloud project. Business Profile also requires approved API access.');
  if (response.status === 403 || response.status === 401)
    throw issue(403,'GOOGLE_ACCESS','Google denied access. Check the account permissions, selected OAuth scopes and API approval.');
  if (response.status === 404) throw issue(404,'GOOGLE_NOT_FOUND','Google could not find this property or location for this account.');
  throw issue(502,'GOOGLE_REQUEST_FAILED','Google could not complete this request (HTTP ' + response.status + '). Check the property and retry.');
}
const api = (url, token, body) => googleFetch(url, {
  method: body ? 'POST' : 'GET',
  headers: { Authorization: 'Bearer ' + token, ...(body ? {'Content-Type':'application/json'} : {}) },
  ...(body ? {body:JSON.stringify(body)} : {})
});
function parameters(base, params) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  return url;
}
export async function discover(token, source, pageToken) {
  if (pageToken && pageToken.length > 4096) throw issue(400, 'BAD_CURSOR','Invalid Google page token.');
  if (source === 'ga4') {
    const r = await api(parameters(gaAdmin + '/accountSummaries', {pageSize:200,pageToken}), token);
    return {resources:(r.accountSummaries || []).flatMap(account => (account.propertySummaries || []).map(p =>
      ({id:p.property,label:p.displayName || p.property,description:account.displayName || account.account}))), nextPageToken:r.nextPageToken || null};
  }
  if (source === 'gsc') {
    const r = await api(gscRoot, token);
    return {resources:(r.siteEntry || []).filter(p => p.permissionLevel !== 'siteUnverifiedUser').map(p =>
      ({id:p.siteUrl,label:p.siteUrl,description:p.permissionLevel})), nextPageToken:null};
  }
  const r = await api(parameters(gbpInfo + '/accounts/-/locations',{readMask:'name,title,storefrontAddress',pageSize:100,pageToken}),token);
  return {resources:(r.locations || []).map(p => ({id:p.name,label:p.title || p.name,description:p.storefrontAddress?.locality || ''})),nextPageToken:r.nextPageToken || null};
}
export async function resourceInfo(token, source, resource) {
  checkResource(source, resource);
  if (source === 'ga4') {
    const p = await api(gaAdmin + '/' + resource, token);
    return {label:p.displayName || resource, profile:{title:p.displayName,timeZone:p.timeZone,currencyCode:p.currencyCode}};
  }
  if (source === 'gsc') {
    const p = await api(gscRoot + '/' + encodeURIComponent(resource), token);
    if (p.permissionLevel === 'siteUnverifiedUser') throw issue(403,'GOOGLE_ACCESS','Verify this Search Console property or choose a verified property.');
    return {label:p.siteUrl || resource, profile:{permissionLevel:p.permissionLevel}};
  }
  const p = await api(parameters(gbpInfo + '/' + resource,{readMask:profileFields}), token);
  return {label:p.title || resource,profile:p};
}
function dateInZone(daysAgo, zone) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get = type => Number(parts.find(p => p.type === type).value);
  return new Date(Date.UTC(get('year'),get('month') - 1,get('day') - daysAgo)).toISOString().slice(0,10);
}
const order = (a,b) => a.date.localeCompare(b.date);
const gaDay = s => s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8);
const metric = (row,index) => Number(row.metricValues[index].value);
export async function realtime(token, resource) {
  const r = await api(gaData + '/' + resource + ':runRealtimeReport', token, {metrics:[{name:'activeUsers'}],
    minuteRanges:[{startMinutesAgo:29,endMinutesAgo:0}]});
  return {activeUsers:r.rows?.length ? metric(r.rows[0],0) : 0,observedAt:nowIso(),windowMinutes:30};
}
export async function daily(token, source, resource, profile) {
  checkResource(source, resource);
  if (source === 'gsc') {
    const r = await api(gscRoot + '/' + encodeURIComponent(resource) + '/searchAnalytics/query', token, {
      startDate:dateInZone(90,'America/Los_Angeles'),endDate:dateInZone(1,'America/Los_Angeles'),dimensions:['date'],dataState:'final',type:'web',rowLimit:100});
    return {points:(r.rows || []).map(p => ({date:p.keys[0],clicks:p.clicks,impressions:p.impressions,ctr:p.ctr,position:p.position})).sort(order)};
  }
  if (source === 'ga4') {
    const request = {dateRanges:[{startDate:'90daysAgo',endDate:'yesterday'}],dimensions:[{name:'date'}],limit:'100'};
    const [report, ai] = await Promise.allSettled([
      api(gaData + '/' + resource + ':runReport',token,{...request,metrics:['sessions','activeUsers','keyEvents'].map(name => ({name}))}),
      api(gaData + '/' + resource + ':runReport',token,{...request,metrics:[{name:'sessions'}],dimensionFilter:{
        andGroup:{expressions:[{filter:{fieldName:'sessionSource',stringFilter:{matchType:'FULL_REGEXP',value:aiRegex,caseSensitive:false}}},
          {filter:{fieldName:'sessionMedium',stringFilter:{matchType:'EXACT',value:'referral',caseSensitive:false}}}]}}})
    ]);
    if (report.status === 'rejected') throw report.reason;
    const referrals = new Map(ai.status === 'fulfilled' ? (ai.value.rows || []).map(p => [p.dimensionValues[0].value,metric(p,0)]) : []);
    const points = (report.value.rows || []).map(p => {
      const day = p.dimensionValues[0].value;
      return {date:gaDay(day),sessions:metric(p,0),users:metric(p,1),keyEvents:metric(p,2),
        ...(ai.status === 'fulfilled' ? {aiSessions:referrals.get(day) || 0} : {})};
    }).sort(order);
    return {points,partial:ai.status === 'rejected' ? 'AI referral detail unavailable. ' + ai.reason.message : null,
      profile:{...profile,timeZone:report.value.metadata?.timeZone || profile.timeZone}};
  }
  // Fetch raw content into a short-lived cache. Never persist Business Profile metrics in D1.
  const url = new URL(gbpPerformance + '/' + resource + ':fetchMultiDailyMetricsTimeSeries');
  for (const m of gbpMetrics) url.searchParams.append('dailyMetrics',m);
  for (const [key,daysAgo] of [['start',28],['end',1]]) {
    // Asia/Kolkata is the agency's default reporting boundary for Indian business locations.
    const [year,month,day] = dateInZone(daysAgo,'Asia/Kolkata').split('-');
    for (const [part,value] of Object.entries({year,month,day})) url.searchParams.set('dailyRange.' + key + '_date.' + part,String(Number(value)));
  }
  const [raw,detail] = await Promise.allSettled([api(url,token),resourceInfo(token,source,resource)]);
  if (raw.status === 'rejected') throw raw.reason;
  return {raw:raw.value,profile:detail.status === 'fulfilled' ? detail.value.profile : null,
    partial:detail.status === 'rejected' ? 'Profile details unavailable. ' + detail.reason.message : null};
}
export function businessPoints(raw) {
  const dates = new Map();
  for (const group of raw?.multiDailyMetricTimeSeries || []) {
    for (const series of group.dailyMetricTimeSeries || []) {
      for (const dated of series.timeSeries?.datedValues || []) {
        const {year,month,day} = dated.date || {};
        if (!year || !month || !day) continue;
        const date = [year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
        const values = dates.get(date) || {};
        values[series.dailyMetric] = Number(dated.value || 0);
        dates.set(date,values);
      }
    }
  }
  return [...dates].map(([date,values]) => {
    const p = {date};
    // Google's impression series describe separate surfaces, with no cross-surface deduplication.
    if (gbpMetrics.slice(0,4).every(k => k in values)) p.impressions = gbpMetrics.slice(0,4).reduce((n,k) => n + values[k],0);
    for (const [key,label] of [['CALL_CLICKS','calls'],['WEBSITE_CLICKS','websiteClicks'],['BUSINESS_DIRECTION_REQUESTS','directions']]) if (key in values) p[label] = values[key];
    return p;
  }).sort(order);
}
