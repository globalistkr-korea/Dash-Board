import { cumulativeComparison } from './cumulativeComparison.js';

export function customerRankings(rows, { year, month = 0, actualCount, previousActualCount, allowPreviousYear = true, profitField = 'grossProfit' }) {
  const field = profitField === 'opProfit' ? 'opProfit' : 'grossProfit';
  const comparisons = rows.map(({ e, v }) => {
    const c = cumulativeComparison(v, { year, month, actualCount, previousActualCount: allowPreviousYear ? previousActualCount : 0 });
    return { name: e.name, region: e.region, measures: Object.fromEntries(c.rows.map(r => [r.field, r])) };
  });
  const revenueTotal = comparisons.reduce((sum, r) => sum + (r.measures.revenue.current.value ?? 0), 0);
  const ranked = metric => comparisons
    .filter(r => r.measures[metric].current.value != null)
    .sort((a, b) => b.measures[metric].current.value - a.measures[metric].current.value || a.name.localeCompare(b.name, 'ko'))
    .slice(0, 10)
    .map((r, i) => {
      const measure = r.measures[metric];
      const revenue = r.measures.revenue.current;
      return { name: r.name, region: r.region, rank: i + 1, ...measure,
        share: revenueTotal > 0 ? revenue.value / revenueTotal * 100 : null,
        margin: measure.current.complete && revenue.complete && revenue.value !== 0 ? measure.current.value / revenue.value * 100 : null };
    });
  const revenue = ranked('revenue');
  const topRevenue = revenue.reduce((sum, r) => sum + r.current.value, 0);
  return { year, previousYear: String(Number(year) - 1), endMonth: Math.min(month || actualCount, actualCount, 12),
    revenue, profit: ranked(field), profitField: field, revenueTotal, topRevenue,
    topRevenueShare: revenueTotal > 0 ? topRevenue / revenueTotal * 100 : null };
}
