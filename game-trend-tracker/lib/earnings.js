// Earnings ESTIMATES from public signals. Real creator payouts are private —
// no platform exposes them — so every figure here is a labeled estimate range
// built from widely published industry heuristics. Methodology is documented
// in the README and surfaced in the dashboard footnote.

// Twitch heuristics:
// - Ads: ~2–3 ad impressions per viewer-hour at a $3.50–$10 CPM.
// - Subs: active sub count is typically ~1x–3x average concurrent viewers;
//   a tier-1 sub nets the streamer ~$2.50/month; spread over ~80 streaming
//   hours/month to express it hourly.
const AD_CPM_LOW = 3.5;
const AD_CPM_HIGH = 10;
const AD_IMPRESSIONS_PER_VIEWER_HOUR_LOW = 2;
const AD_IMPRESSIONS_PER_VIEWER_HOUR_HIGH = 3;
const SUBS_PER_VIEWER_LOW = 1.0;
const SUBS_PER_VIEWER_HIGH = 3.0;
const NET_PER_SUB_MONTHLY = 2.5;
const STREAM_HOURS_PER_MONTH = 80;

// YouTube gaming RPM (revenue per 1k views) commonly lands in this range.
const YT_RPM_LOW = 1.5;
const YT_RPM_HIGH = 4.0;

function estimateStreamerHourly(concurrentViewers) {
  const adLow = (concurrentViewers / 1000) * AD_CPM_LOW * AD_IMPRESSIONS_PER_VIEWER_HOUR_LOW;
  const adHigh = (concurrentViewers / 1000) * AD_CPM_HIGH * AD_IMPRESSIONS_PER_VIEWER_HOUR_HIGH;
  const subLow = (concurrentViewers * SUBS_PER_VIEWER_LOW * NET_PER_SUB_MONTHLY) / STREAM_HOURS_PER_MONTH;
  const subHigh = (concurrentViewers * SUBS_PER_VIEWER_HIGH * NET_PER_SUB_MONTHLY) / STREAM_HOURS_PER_MONTH;
  return {
    low: Math.round(adLow + subLow),
    high: Math.round(adHigh + subHigh),
    unit: 'USD/hr',
    estimated: true,
  };
}

function estimateYouTubeRevenue(totalViews) {
  return {
    low: Math.round((totalViews / 1000) * YT_RPM_LOW),
    high: Math.round((totalViews / 1000) * YT_RPM_HIGH),
    unit: 'USD',
    estimated: true,
  };
}

const METHODOLOGY =
  'Earnings are estimates from public signals only (viewer counts, view counts) using published ' +
  'industry heuristics: Twitch ads ~2-3 impressions/viewer-hour at $3.50-$10 CPM, subs ~1-3x avg ' +
  'viewers at ~$2.50 net/sub/month over ~80 stream hours; YouTube gaming RPM $1.50-$4.00 per 1k views. ' +
  'Actual payouts are private and vary widely.';

module.exports = { estimateStreamerHourly, estimateYouTubeRevenue, METHODOLOGY };
