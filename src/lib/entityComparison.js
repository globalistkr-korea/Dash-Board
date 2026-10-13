const total = (series, months) => months.reduce((sum, m) => sum + (series?.[m] || 0), 0);
export function comparisonMonths(year, month, actualCount, basis) {
  const current = month ? [month - 1] : Array.from({ length: actualCount }, (_, i) => i);
  if (basis === 'mom' && month > 1) return { current, previous: [month - 2], previousYear: year };
  return { current, previous: current, previousYear: String(Number(year) - 1) };
}
export function entityComparison(v, year, months, baseline) {
  const recorded = months.filter(m => v.coverage?.[year]?.[m]);
  const present = (field, y, ms) => ms.length > 0 && ms.every(m => v.coverage?.[y]?.[m] && v.fieldCoverage?.[field]?.[y]?.[m]);
  const measure = field => recorded.length && recorded.some(m => v.fieldCoverage?.[field]?.[year]?.[m]) ? total(v[field]?.[year], months) : null;
  const revenue = measure('revenue'), grossProfit = measure('grossProfit'), opProfit = measure('opProfit');
  const comparable = present('revenue', year, months) && present('revenue', baseline.previousYear, baseline.previous);
  const previousRevenue = comparable ? total(v.revenue?.[baseline.previousYear], baseline.previous) : null;
  const comparableProfit = present('opProfit', year, months) && present('opProfit', baseline.previousYear, baseline.previous);
  const previousOpProfit = comparableProfit ? total(v.opProfit?.[baseline.previousYear], baseline.previous) : null;
  const revenueMonths = recorded.filter(m => v.fieldCoverage?.revenue?.[year]?.[m]);
  return { revenue, grossProfit, opProfit, margin: revenue && opProfit != null ? opProfit / revenue * 100 : null,
    completeCurrent: ['revenue','grossProfit','opProfit'].every(field=>present(field,year,months)),
    monthlyAverage: revenueMonths.length ? total(v.revenue?.[year], revenueMonths) / revenueMonths.length : null,
    recordedCount: recorded.length, periodCount: months.length, previousRevenue, previousOpProfit,
    delta: comparable ? revenue - previousRevenue : null,
    profitDelta: comparableProfit ? opProfit - previousOpProfit : null,
    pct: comparable && previousRevenue ? (revenue - previousRevenue) / Math.abs(previousRevenue) * 100 : null,
  };
}
