// 3개년(2024·2025·2026) 베트남 경영실적/계획 데이터 셀렉터.
// 원본 단위: 백만원. 표시: 매출=억원(÷100), 매출이익/영업이익=백만원.
import raw from '../data/plan3y.json';

export const YEARS = raw.years;                       // ['2024','2025','2026']
export const BASE_METRICS = ['매출', '매출원가', '매출이익', '영업이익']; // 시트에서 파싱
export const PL_METRICS = ['매출', '매출원가', '매출이익', '판관비', '영업이익']; // 손익 표시 순서
// 도출 지표: 판관비 = 매출이익 − 영업이익
const DERIVED = { '판관비': ['매출이익', '영업이익'] };
export const METRICS = BASE_METRICS;                  // (호환) leaves 보유 지표
export const CURRENT_YEAR = YEARS[YEARS.length - 1];
const actualMonths = raw.actualMonths;

const Z12 = () => Array(12).fill(0);
const sum = (a) => a.reduce((x, v) => x + (v || 0), 0);
const addInto = (acc, arr) => { for (let i = 0; i < 12; i++) acc[i] += arr[i] || 0; return acc; };

// 월 메타: 해당 연도의 실적/계획 구분
export function monthsMeta(year) {
  const n = actualMonths[year] ?? 12;
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, type: i < n ? '실적' : '계획',
  }));
}
export const actualCount = (year) => actualMonths[year] ?? 12;

// 지표 데이터(없으면 null)
const md = (year, metric) => raw.data?.[year]?.[metric] || null;

// 필터된 월별 시리즈(백만원). clff/region/subtype = '전체' | 값
export function series(year, metric, clff = '전체', region = '전체', subtype = '전체') {
  if (DERIVED[metric]) {       // 도출 지표(판관비 = 매출이익 − 영업이익)
    const [a, b] = DERIVED[metric];
    const sa = series(year, a, clff, region, subtype);
    const sb = series(year, b, clff, region, subtype);
    return sa.map((v, i) => v - sb[i]);
  }
  const m = md(year, metric);
  if (!m) return Z12();
  if (clff === '전체' && region === '전체' && subtype === '전체') return m.total.slice();
  const acc = Z12();
  for (const lf of m.leaves) {
    if (clff !== '전체' && lf.clff !== clff) continue;
    if (region !== '전체' && lf.region !== region) continue;
    if (subtype !== '전체' && lf.subtype !== subtype) continue;
    addInto(acc, lf.values);
  }
  return acc;
}

export const annual = (year, metric, clff, region, subtype) => sum(series(year, metric, clff, region, subtype));
export const ytd = (year, metric, clff, region, subtype) =>
  sum(series(year, metric, clff, region, subtype).slice(0, actualCount(year)));

// 특정 사업(clff)의 세부 구분 목록 (전 연도·지표 합집합, 표시 순서대로)
export function subtypeList(clff = '전체') {
  if (clff === '전체') return [];
  const set = new Set();
  for (const y of YEARS) for (const mt of METRICS) {
    const m = md(y, mt);
    if (!m) continue;
    for (const lf of m.leaves) if (lf.clff === clff) set.add(lf.subtype);
  }
  const order = ['WM', 'TM', 'S/P', '해상', '항공', 'CC', 'Haulage', 'FF', 'PJT'];
  return [...set].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

// 세부(subtype) 분해: [{subtype, values[12], annual}]
export function bySubtype(year, metric, clff = '전체', region = '전체') {
  const m = md(year, metric);
  if (!m) return [];
  const map = {};
  for (const lf of m.leaves) {
    if (clff !== '전체' && lf.clff !== clff) continue;
    if (region !== '전체' && lf.region !== region) continue;
    if (!map[lf.subtype]) map[lf.subtype] = Z12();
    addInto(map[lf.subtype], lf.values);
  }
  return Object.entries(map)
    .map(([subtype, values]) => ({ subtype, values, annual: sum(values) }))
    .sort((a, b) => b.annual - a.annual);
}

// 이익률(%) = 이익/매출
export function marginPct(year, profitMetric, clff = '전체', region = '전체') {
  const rev = annual(year, '매출', clff, region);
  const pr = annual(year, profitMetric, clff, region);
  return rev ? (pr / rev) * 100 : null;
}

// 전년대비 증감률(%)
export function yoy(year, metric, clff = '전체', region = '전체', subtype = '전체') {
  const i = YEARS.indexOf(year);
  if (i <= 0) return null;
  const prev = annual(YEARS[i - 1], metric, clff, region, subtype);
  const cur = annual(year, metric, clff, region, subtype);
  return prev ? ((cur - prev) / Math.abs(prev)) * 100 : null;
}

// ── 인사이트 자동 생성 ──────────────────────────────────────
const pct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const eok = (krwMn) => `${(krwMn / 100).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}억원`;

export function insights(clff = '전체', region = '전체') {
  const out = [];
  const y0 = YEARS[0], y1 = YEARS[YEARS.length - 1];

  // 1) 매출 3개년 성장
  const rev0 = annual(y0, '매출', clff, region);
  const rev1 = annual(y1, '매출', clff, region);
  const g = yoy(y1, '매출', clff, region);
  if (rev0 && rev1) {
    const cagr = (Math.pow(rev1 / rev0, 1 / (YEARS.length - 1)) - 1) * 100;
    out.push({
      kind: rev1 >= rev0 ? 'up' : 'down',
      text: `매출은 ${y0}년 ${eok(rev0)} → ${y1}년 ${eok(rev1)}로 연평균 ${pct(cagr)} 성장${g != null ? `, 전년비 ${pct(g)}` : ''}.`,
    });
  }

  // 2) CL/FF 믹스 변화
  if (clff === '전체') {
    const clShare = (y) => { const t = annual(y, '매출'); return t ? annual(y, '매출', 'CL') / t * 100 : 0; };
    const s0 = clShare(y0), s1 = clShare(y1);
    out.push({
      kind: 'info',
      text: `사업 믹스: CL 비중 ${s0.toFixed(0)}%→${s1.toFixed(0)}% (${y1}년 CL ${eok(annual(y1, '매출', 'CL'))} / FF ${eok(annual(y1, '매출', 'FF'))}). FF 비중이 ${s1 < s0 ? '확대' : '축소'}.`,
    });
  }

  // 3) 영업이익률 추이
  const m0 = marginPct(y0, '영업이익', clff, region);
  const m1 = marginPct(y1, '영업이익', clff, region);
  if (m0 != null && m1 != null) {
    out.push({
      kind: m1 >= m0 ? 'up' : 'down',
      text: `영업이익률 ${m0.toFixed(1)}%→${m1.toFixed(1)}% (${(m1 - m0).toFixed(1)}%p). ${y1}년 영업이익 ${annual(y1, '영업이익', clff, region).toLocaleString('ko-KR')}백만원.`,
    });
  }

  // 4) 북부 수익성 경고
  if (region === '전체') {
    const opN = annual(y1, '영업이익', clff, '북부');
    const opS = annual(y1, '영업이익', clff, '남부');
    if (opN < 0) out.push({ kind: 'warn', text: `${y1}년 북부 영업이익 ${opN.toLocaleString('ko-KR')}백만원으로 적자 — 남부(${opS.toLocaleString('ko-KR')}백만원) 대비 수익성 점검 필요.` });
    else out.push({ kind: 'info', text: `${y1}년 지역별 영업이익: 남부 ${opS.toLocaleString('ko-KR')} / 북부 ${opN.toLocaleString('ko-KR')}백만원.` });
  }

  return out;
}
