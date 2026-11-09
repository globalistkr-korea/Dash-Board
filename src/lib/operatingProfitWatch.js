const fields = ['revenue', 'grossProfit', 'opProfit'];
export const WATCH_METRICS = ['revenue', 'costOfSales', 'grossProfit', 'sga', 'opProfit', 'opMargin'];

export function watchBusinessScope(clff, subtype) {
  if (subtype === '전체') return '전체';
  if (clff === 'CL' && subtype === 'WM') return '창고';
  if (clff === 'CL' && subtype === 'TM') return '운송';
  return null;
}

const difference = (after, before) => after == null || before == null ? null : after - before;

function readPeriod(segments, year, months, actualCount) {
  const byMonth = months.map(month => month < actualCount
    ? segments.filter(s => s.coverage?.[year]?.[month]) : []);
  const present = byMonth.some(active => active.length > 0);
  const values = Object.fromEntries(fields.map(field => {
    const complete = months.length > 0 && byMonth.every((active, i) => active.length > 0 && active.every(s =>
      s.fieldCoverage?.[field]?.[year]?.[months[i]] && Number.isFinite(s[field]?.[year]?.[months[i]])));
    return [field, complete ? byMonth.reduce((sum, active, i) =>
      active.reduce((subtotal, s) => subtotal + s[field][year][months[i]], sum), 0) : null];
  }));
  return {
    ...values, present,
    businesses: [...new Set(byMonth.flatMap(active => active.map(s => s.business)).filter(Boolean))],
    costOfSales: difference(values.revenue, values.grossProfit),
    sga: difference(values.grossProfit, values.opProfit),
    opMargin: values.revenue > 0 && values.opProfit != null ? values.opProfit / values.revenue * 100 : null,
  };
}

// Keep money in million VND and rank only by complete, like-for-like operating profit.
export function operatingProfitWatch(entities, cmp, actualCounts) {
  if (!cmp) return { rows: [], excluded: 0 };
  const candidates = [];
  let excluded = 0;
  for (const { name, region, segments } of entities) {
    const before = readPeriod(segments, cmp.by, cmp.bm, actualCounts[cmp.by] ?? 0);
    const after = readPeriod(segments, cmp.cy, cmp.cm, actualCounts[cmp.cy] ?? 0);
    if (!before.present && !after.present) continue;
    const delta = Object.fromEntries(WATCH_METRICS.map(field => [field, difference(after[field], before[field])]));
    if (delta.opProfit == null) excluded++;
    else if (delta.opProfit < -1e-8) candidates.push({
      name, region, before, after, delta,
      businesses: [...new Set([...before.businesses, ...after.businesses])],
    });
  }
  candidates.sort((a, b) => a.delta.opProfit - b.delta.opProfit || a.name.localeCompare(b.name, 'ko'));
  return { rows: candidates.slice(0, 5), excluded };
}
