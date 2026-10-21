export const MONTHLY_VIEW_KEY = 'vn_dashboard_monthly_view_pnl_v2';
const viewModes = ['요약', '점검', '상세'];
const bases = ['mom', 'yoy', 'ytd'];
const range = n => Array.from({ length: n }, (_, i) => i);
const sum = (values, months) => months.reduce((total, m) => total + (values?.[m] || 0), 0);
const pct = (current, previous) => previous ? (current - previous) / Math.abs(previous) * 100 : null;

export function normalizeMonthlyView(saved, actualCount) {
  const value = saved && typeof saved === 'object' ? saved : {};
  const input = typeof value.month === 'number' || typeof value.month === 'string' && value.month.trim() !== '' ? Number(value.month) : NaN;
  const month = Number.isInteger(input) && input >= 0 ? Math.min(input, actualCount) : 0;
  const requested = bases.includes(value.compareBasis) ? value.compareBasis : month > 1 ? 'mom' : 'yoy';
  return { month, viewMode: viewModes.includes(value.viewMode) ? value.viewMode : '요약',
    compareBasis: month === 0 ? 'ytd' : month === 1 && requested === 'mom' ? 'yoy' : requested };
}

export function monthlyPeriod({ year, month, actualCount, previousActualCount, hasPreviousYear, compareBasis }) {
  const selected = normalizeMonthlyView({ month, compareBasis }, actualCount);
  const isAll = selected.month === 0;
  const throughMonth = isAll ? actualCount : selected.month;
  const previousYear = String(Number(year) - 1);
  const canCompareYear = hasPreviousYear && previousActualCount >= throughMonth;
  const basis = isAll ? 'ytd' : !canCompareYear ? 'mom' : selected.compareBasis;
  const cumulativeMonths = range(throughMonth);
  const comparison = basis === 'mom'
    ? throughMonth > 1 ? { by: year, bm: [throughMonth - 2], cy: year, cm: [throughMonth - 1] } : null
    : canCompareYear ? { by: previousYear, bm: basis === 'ytd' ? cumulativeMonths : [throughMonth - 1],
      cy: year, cm: basis === 'ytd' ? cumulativeMonths : [throughMonth - 1] } : null;
  return { year, previousYear, isAll, throughMonth, actualCount, basis, cumulativeMonths,
    hasPreviousYear: canCompareYear, comparison };
}

export function monthlyMetricRows(metrics, getSeries, period) {
  return metrics.map(metric => {
    const cur = getSeries(period.year, metric), prv = getSeries(period.previousYear, metric);
    const m = period.throughMonth;
    const cm = cur[m - 1] ?? 0, pm = m >= 2 ? cur[m - 2] : null;
    const ym = period.hasPreviousYear ? prv[m - 1] : null;
    const ytdC = sum(cur, period.cumulativeMonths);
    const ytdP = period.hasPreviousYear ? sum(prv, period.cumulativeMonths) : null;
    const annual = sum(cur, range(period.actualCount));
    return { metric, cm, pm, ym, annual, mom: pm == null ? null : pct(cm, pm),
      yoy: ym == null ? null : pct(cm, ym), ytdC, ytdP,
      ytdDelta: ytdP == null ? null : ytdC - ytdP,
      ytdYoy: ytdP == null ? null : pct(ytdC, ytdP), progress: annual ? ytdC / annual * 100 : null };
  });
}
