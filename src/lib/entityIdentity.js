// Join only user-confirmed aliases; retain source names and separate segments.
export const CONFIRMED_WAREHOUSE_ALIASES = [{
  canonical: 'Hai Nam (북부)', aliases: ['HAINAM'], region: '북부',
  costCenters: { '창고': ['3120083019'], '운송': ['3120083015'] },
  reason: '사용자 확인 · 동일 거점',
}];
const fields = ['revenue', 'directCost', 'directProfit', 'indirectCost', 'grossProfit', 'opProfit'];
function addSeries(target, source, boolean = false) {
  for (const [year, series] of Object.entries(source || {})) {
    target[year] ||= Array(12).fill(boolean ? false : 0);
    series.forEach((value, i) => { target[year][i] = boolean ? Boolean(target[year][i] || value) : (target[year][i] || 0) + value; });
  }
}
function combineSegment(target, source) {
  for (const f of fields) addSeries(target[f] ||= {}, source[f]);
  for (const f of ['items', 'fieldCoverage', 'itemCoverage']) {
    target[f] ||= {};
    for (const [key, series] of Object.entries(source[f] || {})) addSeries(target[f][key] ||= {}, series, f !== 'items');
  }
  addSeries(target.coverage ||= {}, source.coverage, true);
  target.sourceNames = [...new Set([...(target.sourceNames || []), ...(source.sourceNames || [])])];
  target.costCenters ||= {};
  for (const [year, months] of Object.entries(source.costCenters || {})) {
    target.costCenters[year] ||= Array.from({ length: 12 }, () => []);
    months.forEach((values, i) => { target.costCenters[year][i] = [...new Set([...target.costCenters[year][i], ...values])]; });
  }
}
function safeAlias(entity, rule) {
  return entity.region === rule.region && Object.entries(entity.data || {}).every(([segment, data]) => {
    const allowed = rule.costCenters[segment];
    const centers = Object.values(data.costCenters || {}).flat(2);
    return allowed && centers.length > 0 && centers.every(cc => allowed.includes(cc));
  });
}
export function canonicalWarehouses(source) {
  const output = structuredClone(source);
  for (const rule of CONFIRMED_WAREHOUSE_ALIASES) {
    const target = output[rule.canonical];
    if (!target || target.region !== rule.region) continue;
    for (const name of rule.aliases) {
      const donor = output[name];
      if (!donor || !safeAlias(donor, rule)) continue;
      for (const [segment, data] of Object.entries(donor.data)) combineSegment(target.data[segment] ||= {}, data);
      target.segs = Object.keys(target.data);
      target.clff = [...new Set([...target.clff, ...donor.clff])];
      target.aliasNames = [...new Set([...(target.aliasNames || []), name])];
      target.identityReason = rule.reason;
      delete output[name];
    }
  }
  return output;
}
export function inputState(v, year, months, item = null) {
  if (!v.coverage) return 'unknown';
  if (!months.some(i => v.coverage[year]?.[i])) return 'noRows';
  if (item && !months.some(i => v.itemCoverage?.[item]?.[year]?.[i])) return 'missingValue';
  return 'recorded';
}
// A shared cost center indicates a possible rename/reallocation, not the same
// physical site. Candidates never change the financial aggregates.
export function identityCandidates(entities, year, previousMonths, currentMonths, segments) {
  const candidates = [];
  for (const old of entities) for (const segment of segments(old)) {
    const data = old.data[segment];
    if (!previousMonths.some(m => data.coverage?.[year]?.[m]) || currentMonths.some(m => data.coverage?.[year]?.[m])) continue;
    const centers = new Set(previousMonths.flatMap(m => data.costCenters?.[year]?.[m] || []));
    if (!centers.size) continue;
    for (const next of entities) {
      if (next.name === old.name || next.region !== old.region || old.region === '미지정') continue;
      const current = next.data[segment];
      if (!current || !currentMonths.some(m => current.coverage?.[year]?.[m])) continue;
      const shared = [...new Set(currentMonths.flatMap(m => current.costCenters?.[year]?.[m] || []).filter(cc => centers.has(cc)))];
      if (shared.length) candidates.push({ from: old.name, to: next.name, region: old.region, segment, costCenters: shared });
    }
  }
  return candidates;
}
