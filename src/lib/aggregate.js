// dashboard.json(raw VND 원단위)을 백만동 기준으로 환산·집계한다.
import data from '../data/dashboard.json';

const M = 1_000_000;
const toM = (v) => (v == null || isNaN(v) ? 0 : v / M);

export const meta = data.meta || {};
export const plan = data.plan || { months: [], metrics: {} };
export const warehouseMaster = data.warehouses || [];
export const clientContracts = data.clientContracts || [];
export const vendors = data.vendors || [];

// raw → 백만동 환산본
export const raw = (data.raw || []).map((r) => ({
  ...r,
  revenue: toM(r.revenue),
  storage: toM(r.storage),
  handling: toM(r.handling),
  transport: toM(r.transport),
  directCost: toM(r.directCost),
  directProfit: toM(r.directProfit),
  grossProfit: toM(r.grossProfit),
  opProfit: toM(r.opProfit),
}));

// 데이터에 들어있는 월 목록 (정렬)
export const dataMonths = [...new Set(raw.map((r) => `${r.year} ${r.month}`))];

const FIELDS = ['revenue', 'storage', 'handling', 'transport', 'grossProfit', 'opProfit'];

function emptyAgg(key) {
  const o = { key, count: 0, rows: [] };
  FIELDS.forEach((f) => (o[f] = 0));
  return o;
}

// 임의 키로 group by + 합계
export function groupBy(rows, keyFn) {
  const map = {};
  for (const r of rows) {
    const k = keyFn(r) || '(미지정)';
    if (!map[k]) map[k] = emptyAgg(k);
    const g = map[k];
    g.count += 1;
    g.rows.push(r);
    FIELDS.forEach((f) => (g[f] += r[f]));
  }
  return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}

// CL/FF 필터 (clff: 'CL' | 'FF' | 'all')
export function filterClff(rows, clff) {
  if (!clff || clff === 'all') return rows;
  return rows.filter((r) => r.clff === clff);
}

// 지역 필터 (region: '북부' | '남부' | 'all')
export function filterRegion(rows, region) {
  if (!region || region === 'all') return rows;
  return rows.filter((r) => r.region === region);
}

// 데이터에 존재하는 지역 목록
export const regions = [...new Set(raw.map((r) => r.region))];

// 창고별 / 고객사별 집계 (CL/FF 필터 옵션)
export const byWarehouse = (clff = 'all') =>
  groupBy(filterClff(raw, clff), (r) => r.warehouse);
export const byCustomer = (clff = 'all') =>
  groupBy(filterClff(raw, clff), (r) => r.customer);

// 합계 KPI
export function totals(rows) {
  const t = { revenue: 0, storage: 0, handling: 0, transport: 0, grossProfit: 0, opProfit: 0 };
  for (const r of rows) FIELDS.forEach((f) => (t[f] += r[f]));
  return t;
}
