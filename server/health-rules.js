const DAY = 86_400_000;
const sourceLabels = { ga4: "Analytics", gsc: "Search Console", gbp: "Business Profile" };
const maxLag = { ga4: 3, gsc: 5 };
const definitions = {
  ga4: [
    { metric: "sessions", label: "Website sessions", floor: 25, minChange: 15,
      action: "Compare landing pages and traffic channels in GA4. Check recent tag, campaign and site changes for the affected day." },
    { metric: "keyEvents", label: "Key events", floor: 5, minChange: 3,
      action: "Test a booking, call or enquiry that the client tracks. Review key-event settings and compare the change with session volume." },
  ],
  gsc: [
    { metric: "clicks", label: "Organic search clicks", floor: 15, minChange: 8,
      action: "Compare pages and queries for the affected day in Search Console. Check whether impressions, ranking or click-through rate changed." },
  ],
};

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function reportDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const t = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(t) && new Date(t).toISOString().startsWith(value) ? t : NaN;
}

function valueAt(point, metric) {
  const value = point[metric];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function companionMetric(sample, latest, rule) {
  const key = rule.metric === "clicks" ? "impressions" : rule.metric === "keyEvents" ? "sessions" : null;
  if (!key) return null;
  const current = valueAt(latest,key);
  const history = sample.map(row => valueAt(row.point,key));
  if (current === null || history.some(v => v === null)) return null;
  const baseline = median(history);
  if (!baseline) return null;
  const changePercent = Math.round(1000 * (current - baseline) / baseline) / 10;
  const detail = `${key === "impressions" ? "Search impressions" : "Sessions"} were ${current}, compared with a median of ${baseline} on those same dates.`;
  let action;
  if (rule.metric === "clicks") {
    if (changePercent <= -25) action = "Clicks and impressions both declined. Compare affected pages and queries for lost demand or visibility. Check indexing for the largest drops.";
    if (Math.abs(changePercent) <= 10) action = "Impressions held within 10% of their median. Compare CTR, position and query mix on the pages losing clicks.";
  } else if (Math.abs(changePercent) <= 10) {
    action = "Sessions held within 10% of their median. Test the enquiry, phone and booking paths and confirm that each expected key event reaches GA4.";
  }
  return { detail, action, metric:{ key, current, baseline, changePercent } };
}

function performanceRule(rows, rule, latestDay, date) {
  const current = valueAt(rows[0].point, rule.metric);
  if (current === null) return { adequate: false };
  const historic = rows.slice(1).map(row => ({
    value: valueAt(row.point, rule.metric), point: row.point,
    daysAgo: (latestDay - row.day) / DAY,
  })).filter(({ value, daysAgo }) => value !== null && daysAgo <= 28);
  const weekly = historic.filter(row => row.daysAgo % 7 === 0);
  const useWeekly = weekly.length >= 3;
  const sample = useWeekly ? weekly : historic.filter(row => row.daysAgo <= 14);
  if (!useWeekly && sample.length < 7) return { adequate: false };
  const baseline = median(sample.map(row => row.value));
  if (baseline < rule.floor) return { adequate: false };
  const deviation = median(sample.map(row => Math.abs(row.value - baseline)));
  const diff = current - baseline;
  const changePercent = Math.round(1000 * diff / baseline) / 10;
  const gain = diff > 0;
  if (Math.abs(diff) < Math.max(rule.minChange, 3 * deviation)
    || (gain ? changePercent < 35 : changePercent > -30)) return { adequate: true };
  const baselineType = useWeekly ? "same-weekday median" : "recent-day median";
  const metrics = { metric: rule.metric, date, current, baseline, changePercent, baselineType, comparisonDays: sample.length };
  const companion = companionMetric(sample, rows[0].point, rule);
  if (companion) metrics.companion = companion.metric;
  return { adequate: true, alert: {
    key: `${rule.metric}:${gain ? "gain" : "drop"}`, kind: gain ? "gain" : "drop",
    severity: gain ? "info" : changePercent <= -50 ? "critical" : "warning",
    title: `${rule.label} ${gain ? "rose" : "fell"} ${Math.abs(changePercent)}%`,
    detail: `${current} on ${date}, compared with a ${baselineType} of ${baseline} across ${sample.length} reporting days.` + (companion ? " " + companion.detail : ""),
    action: gain ? `Verify which pages or campaigns contributed to the increase. Check that ${rule.metric === "keyEvents" ? "the tracked events represent genuine enquiries" : "the additional traffic produced relevant enquiries"}.` : (companion?.action || rule.action),
    metrics, observedAt: date + "T00:00:00.000Z",
  } };
}

function sourceDay(binding, now) {
  const zone = binding.source === "gsc" ? "America/Los_Angeles" : binding.profile?.timeZone || "UTC";
  try {
    const calendar = new Intl.DateTimeFormat("en-US", { timeZone:zone, year:"numeric", month:"2-digit", day:"2-digit" });
    const parts = Object.fromEntries(calendar.formatToParts(now).map(p => [p.type,p.value]));
    return reportDate(parts.year + "-" + parts.month + "-" + parts.day);
  } catch { return reportDate(now.toISOString().slice(0,10)); }
}

/** Keep source-day boundaries, processing delay, and missing rows separate. */
export function assessBinding(binding, now = new Date()) {
  const nowIso = now.toISOString();
  const at = now.getTime();
  const today = sourceDay(binding, now);
  const isGbp = binding.source === "gbp";
  const points = new Map();
  if (!isGbp) for (const point of binding.points || []) {
    const day = reportDate(point.date);
    if (day < today) points.set(day, { day, point });
  }
  const rows = Array.from(points.values()).sort((a, b) => b.day - a.day);
  const latest = rows[0];
  const latestDate = latest?.point.date ?? null;
  const check = { bindingId: binding.id, clientId: binding.clientId, source: binding.source,
    state: "warming", detail: "Waiting for the first successful collection.", lastSync: binding.lastSync || null, latestDate, checkedAt: nowIso };
  const alerts = [];
  const assessedKeys = ["sync", "freshness", "realtime"];
  const sourceLabel = sourceLabels[binding.source] || "Source";
  const syncTime = Date.parse(binding.lastSync);
  const syncAge = at - syncTime;
  const dailyFailure = binding.lastError && !(Number.isFinite(syncTime) && syncTime >= Date.parse(binding.lastAttempt));
  if (binding.lastError) {
    check.state = "warning";
    check.detail = "The latest collection reported an error.";
    alerts.push({ key: "sync", kind: "sync", severity: "warning", title: sourceLabel + " collection needs attention",
      detail: String(binding.lastError).slice(0, 350), action: "Open Connections, verify access to this property and retry its sync.",
      observedAt: binding.lastAttempt || nowIso, metrics: {} });
  }
  if (binding.source === "ga4" && binding.realtimeError) {
    check.state = "warning";
    check.detail = "The most recent realtime collection failed.";
    alerts.push({key:"realtime",kind:"sync",severity:"warning",title:"Analytics realtime collection failed",
      detail:String(binding.realtimeError).slice(0,350),action:"Retry the live view and check the property's GA4 Data API access and quota.",
      observedAt:binding.realtimeAttempt || nowIso,metrics:{}});
  }
  const staleSync = Number.isFinite(syncAge) && syncAge > 36 * 3_600_000;
  const staleData = !!latest && (today - latest.day) / DAY > maxLag[binding.source];
  if (staleSync || staleData) {
    check.state = "stale";
    check.detail = staleSync ? "The last successful collection is more than 36 hours old." : `The most recent reporting date is ${latestDate}.`;
    alerts.push({ key: "freshness", kind: "freshness", severity: "warning", title: sourceLabel + " data is overdue",
      detail: check.detail, action: "Retry the connection. Compare its latest reporting date with the source before investigating a traffic change.",
      observedAt: nowIso, metrics: { lastSync: check.lastSync, latestDate } });
  }
  if (dailyFailure || staleSync || staleData || !Number.isFinite(syncTime)) return { check, alerts, assessedKeys };
  if (isGbp) {
    if (!alerts.length) {
      check.state = "healthy";
      check.detail = "Business Profile collected successfully within the past 36 hours.";
    }
    return { check, alerts, assessedKeys };
  }
  if (!latest) {
    check.detail = "The source responded. No completed daily rows are available for comparison.";
    return { check, alerts, assessedKeys };
  }
  const comparable = binding.source === "ga4" ? rows.filter(row => row.day <= today - 2 * DAY) : rows;
  const target = comparable[0];
  if (!target || (today - target.day) / DAY > maxLag[binding.source]) {
    check.detail = "Waiting for a recent completed reporting day beyond the processing window.";
    return { check, alerts, assessedKeys };
  }
  let adequate = 0;
  for (const rule of definitions[binding.source] || []) {
    const evaluation = performanceRule(comparable, rule, target.day, target.point.date);
    if (!evaluation.adequate) continue;
    adequate += 1;
    assessedKeys.push(rule.metric + ":gain", rule.metric + ":drop");
    if (evaluation.alert) alerts.push(evaluation.alert);
  }
  if (adequate) {
    check.state = alerts.some(a => a.severity === "critical") ? "critical"
      : alerts.some(a => a.severity === "warning") ? "warning" : "healthy";
    check.detail = alerts.length ? alerts.map(a => a.title).join(". ") + "." : `No unusual movement in ${adequate} eligible ${adequate === 1 ? "metric" : "metrics"} on ${target.point.date}.`;
  } else {
    if (!alerts.length) check.detail = "Collecting comparable observations or waiting for sufficient traffic volume.";
  }
  return { check, alerts, assessedKeys };
}
