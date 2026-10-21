export const CUMULATIVE_FIELDS = ['revenue', 'directCost', 'directProfit', 'indirectCost', 'grossProfit', 'opProfit'];

function cumulativeMeasure(v, field, year, months, actualCount) {
  const entered = months.filter(m => m < actualCount && v.coverage?.[year]?.[m]
    && v.fieldCoverage?.[field]?.[year]?.[m] && Number.isFinite(v[field]?.[year]?.[m]));
  const complete = months.length > 0 && entered.length === months.length;
  const hasRows = months.some(m => m < actualCount && v.coverage?.[year]?.[m]);
  const status = complete ? 'complete' : entered.length ? 'partial'
    : actualCount === 0 ? 'unavailable' : !hasRows ? 'noRows' : 'missingValue';
  return { value: entered.length ? entered.reduce((sum, m) => sum + v[field][year][m], 0) : null,
    entered, recordedCount: entered.length, periodCount: months.length, complete, status };
}

function marginMeasure(revenue, profit) {
  const entered = revenue.entered.filter(m => profit.entered.includes(m));
  const complete = revenue.complete && profit.complete;
  return { value: complete && revenue.value !== 0 ? profit.value / revenue.value * 100 : null,
    recordedCount: entered.length, periodCount: revenue.periodCount, complete,
    status: complete ? revenue.value === 0 ? 'zeroRevenue' : 'complete'
      : revenue.status === 'complete' ? profit.status : revenue.status };
}

// Both years start in January and end at the selected/latest collected month.
// A partial total stays visible, but never participates in a change calculation.
export function cumulativeComparison(v, { year, month = 0, actualCount, previousActualCount }) {
  const endMonth = Math.max(0, Math.min(month || actualCount, actualCount, 12));
  const months = Array.from({ length: endMonth }, (_, i) => i);
  const previousYear = String(Number(year) - 1);
  const rows = CUMULATIVE_FIELDS.map(field => {
    const current = cumulativeMeasure(v, field, year, months, actualCount);
    const previous = cumulativeMeasure(v, field, previousYear, months, previousActualCount);
    const comparable = current.complete && previous.complete;
    const delta = comparable ? current.value - previous.value : null;
    return { field, current, previous, delta,
      pct: comparable && previous.value !== 0 ? delta / Math.abs(previous.value) * 100 : null };
  });
  const revenue = rows.find(r => r.field === 'revenue');
  const profit = rows.find(r => r.field === 'opProfit');
  const current = marginMeasure(revenue.current, profit.current);
  const previous = marginMeasure(revenue.previous, profit.previous);
  rows.push({ field: 'opMargin', current, previous,
    delta: current.value != null && previous.value != null ? current.value - previous.value : null, pct: null });
  return { year, previousYear, endMonth, months, rows };
}
