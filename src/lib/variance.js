// 변동 원인 자동 분석 — "매출은 올랐는데 이익이 빠진" 상황을 데이터로 분해.
// 비교는 일반형 cmp = {by, bm, cy, cm} (기준연/기준월들 → 비교연/비교월들).
// plan3y(원, 사업/지역) + ops(동, 창고/고객/원가항목). 모든 수치는 데이터 산출(환각 없음).
import { YEARS, CURRENT_YEAR, actualCount, series as planSeries } from './plan3y';
import { opsList, view } from './ops';

const N = actualCount(CURRENT_YEAR);                       // 누계 개월(예:5)
const PREV = YEARS[YEARS.indexOf(CURRENT_YEAR) - 1];
export const YTD_N = N;
export const CUR_MONTH_NO = N;                             // 당월(1-base)
export const PREV_MONTH_NO = N - 1;                        // 전월(1-base)

// 비교 프리셋
export const cmpYTD = (month = N) => ({ by: PREV, bm: range(month), cy: CURRENT_YEAR, cm: range(month) }); // 선택월 누계 전년比
export const cmpYoYMonth = (month = N) => ({ by: PREV, bm: [month - 1], cy: CURRENT_YEAR, cm: [month - 1] }); // 선택월 전년동월比
export const cmpMoM = (month = N) => (
  month > 1 ? { by: CURRENT_YEAR, bm: [month - 2], cy: CURRENT_YEAR, cm: [month - 1] } : null
); // 선택월 전월比. 1월은 없음

function range(n) { return Array.from({ length: n }, (_, i) => i); }
const pickSum = (arr, months) => months.reduce((s, i) => s + (arr?.[i] || 0), 0);
const pSpan = (year, metric, clff, region, subtype, months) => pickSum(planSeries(year, metric, clff, region, subtype), months);
const yo = (a, b) => (a ? ((b - a) / Math.abs(a)) * 100 : null);
const analysisCount = (cmp) => Math.max(1, ...cmp.cm.map((i) => i + 1));
const ratioPct = (cost, revenue) => (revenue ? (cost / revenue) * 100 : null);
const avgMonthlyRatioPct = (costSeries, revSeries, months) => {
  const rows = months
    .map((i) => ratioPct(costSeries?.[i] || 0, revSeries?.[i] || 0))
    .filter((v) => v != null && Number.isFinite(v));
  return rows.length ? rows.reduce((sum, v) => sum + v, 0) / rows.length : null;
};
const recentMonths = (endMonth, count) => {
  const end = Math.max(1, endMonth);
  const start = Math.max(0, end - count);
  return Array.from({ length: end - start }, (_, i) => start + i);
};
const ratioTrend = (costSeries, revSeries, months) => months.map((i) => ({
  month: i + 1,
  ratio: ratioPct(costSeries?.[i] || 0, revSeries?.[i] || 0),
}));
const basisValue = (item, basis = 'curYtd') => {
  if (basis === 'prevSame') return item.avgRatioPrevYear;
  if (basis === 'recent3') return item.avgRatioRecent3;
  if (basis === 'recent5') return item.avgRatioRecent5;
  return item.avgRatioCurYtd;
};

// 1) 진단
export function marginDiagnosis(cmp, clff = '전체', region = '전체', subtype = '전체') {
  const get = (metric, side) => pSpan(side === 0 ? cmp.by : cmp.cy, metric, clff, region, subtype, side === 0 ? cmp.bm : cmp.cm);
  const rev0 = get('매출', 0), rev1 = get('매출', 1), gp0 = get('매출이익', 0), gp1 = get('매출이익', 1);
  const cogs0 = get('매출원가', 0), cogs1 = get('매출원가', 1);
  const m0 = rev0 ? (gp0 / rev0) * 100 : null, m1 = rev1 ? (gp1 / rev1) * 100 : null;
  const revYoY = yo(rev0, rev1), gpYoY = yo(gp0, gp1);
  return {
    revYoY, gpYoY, cogsYoY: yo(cogs0, cogs1), m0, m1,
    marginPp: (m1 != null && m0 != null) ? m1 - m0 : null,
    anomaly: revYoY > 0 && gpYoY != null && gpYoY < revYoY - 1,
  };
}

// 2) 사업×지역 매출이익 악화 (plan3y, 백만원)
export function segmentDrivers(cmp) {
  const segs = [];
  for (const cl of ['CL', 'FF']) for (const rg of ['남부', '북부', '기타']) {
    const a = pSpan(cmp.by, '매출이익', cl, rg, '전체', cmp.bm), b = pSpan(cmp.cy, '매출이익', cl, rg, '전체', cmp.cm);
    if (a || b) segs.push({ clff: cl, region: rg, prev: a, cur: b, delta: b - a });
  }
  return segs.sort((x, y) => x.delta - y.delta);
}
export const clffDelta = (cl, cmp) => segmentDrivers(cmp).filter((s) => s.clff === cl).reduce((a, s) => a + s.delta, 0);

// 3) 원가 항목 변동 + 구조적/일시적 (ops, 백만동). 구조 판정은 항상 YTD 패턴.
export function costDrivers(region = '전체', clff = '전체', cmp) {
  const acc = {};
  for (const e of opsList('warehouses', region, clff)) {
    const v = view(e, clff, '전체');
    for (const it of Object.keys(v.items || {})) {
      if (!acc[it]) acc[it] = { y25: Array(12).fill(0), y26: Array(12).fill(0) };
      for (let i = 0; i < 12; i++) { acc[it].y25[i] += (v.items[it][PREV]?.[i] || 0); acc[it].y26[i] += (v.items[it][CURRENT_YEAR]?.[i] || 0); }
    }
  }
  const yr = (y) => (y === PREV ? 'y25' : 'y26');
  return Object.entries(acc).map(([item, v]) => {
    const a = pickSum(v[yr(cmp.by)], cmp.bm), b = pickSum(v[yr(cmp.cy)], cmp.cm);
    const months = analysisCount(cmp);
    let up = 0;
    for (let i = 0; i < months; i++) if ((v.y26[i] || 0) > (v.y25[i] || 0) * 1.1) up++;
    return { item, prev: a, cur: b, delta: b - a, yoy: a ? ((b - a) / a) * 100 : null, upMonths: up, structural: up >= Math.ceil(months * 0.6) };
  }).filter((r) => r.delta > 0).sort((x, y) => y.delta - x.delta);
}

// 4) 엔티티(창고/고객) 매출이익 악화 Top (ops, 백만동)
export function entityDrivers(kind, region = '전체', clff = '전체', topN = 4, cmp) {
  const out = [];
  const yr = (y) => (y === PREV ? PREV : CURRENT_YEAR);
  for (const e of opsList(kind, region, clff)) {
    const v = view(e, clff, '전체');
    const a = pickSum(v.grossProfit?.[yr(cmp.by)], cmp.bm), b = pickSum(v.grossProfit?.[yr(cmp.cy)], cmp.cm), r = pickSum(v.revenue?.[cmp.cy], cmp.cm);
    if (r > 200) out.push({ name: e.name, region: e.region, prev: a, cur: b, delta: b - a, turnedLoss: a >= 0 && b < 0 });
  }
  return out.sort((x, y) => x.delta - y.delta).slice(0, topN);
}

// ── 상세 분석(창고/고객/원가항목, 사유 추출) ───────────────────
// plan3y 세부(WM/TM) → ops 사업유형(biz)
export const subtypeToBiz = (subtype) => (subtype === 'WM' ? '창고' : subtype === 'TM' ? '운송' : '전체');

// 엔티티(창고/고객) 매출이익 증감 — 악화/개선 양방향 (biz로 좁힘)
export function entityDeltas(kind, region = '전체', clff = '전체', biz = '전체', cmp) {
  const out = [];
  for (const e of opsList(kind, region, clff)) {
    const v = view(e, clff, biz);
    const a = pickSum(v.grossProfit?.[cmp.by], cmp.bm), b = pickSum(v.grossProfit?.[cmp.cy], cmp.cm);
    const ra = pickSum(v.revenue?.[cmp.by], cmp.bm), rb = pickSum(v.revenue?.[cmp.cy], cmp.cm);
    if (Math.abs(a) + Math.abs(b) + rb === 0) continue;
    out.push({ name: e.name, region: e.region, prev: a, cur: b, delta: b - a, revPrev: ra, revCur: rb, turnedLoss: a >= 0 && b < 0 });
  }
  return out.sort((x, y) => x.delta - y.delta);   // 악화 우선
}

// 엔티티(창고/고객)별 상세 — 매출/이익/마진 변화 + 상승 원가항목 + 판정 근거
export function entityDetails(kind, region = '전체', clff = '전체', biz = '전체', cmp) {
  const out = [];
  for (const e of opsList(kind, region, clff)) {
    const v = view(e, clff, biz);
    const r0 = pickSum(v.revenue?.[cmp.by], cmp.bm), r1 = pickSum(v.revenue?.[cmp.cy], cmp.cm);
    const g0 = pickSum(v.grossProfit?.[cmp.by], cmp.bm), g1 = pickSum(v.grossProfit?.[cmp.cy], cmp.cm);
    const c0 = pickSum(v.directCost?.[cmp.by], cmp.bm), c1 = pickSum(v.directCost?.[cmp.cy], cmp.cm);
    if (Math.abs(g0) + Math.abs(g1) + r1 === 0) continue;
    const m0 = r0 ? (g0 / r0) * 100 : null, m1 = r1 ? (g1 / r1) * 100 : null;
    const rising = Object.keys(v.items || {}).map((it) => {
      const a = pickSum(v.items[it][cmp.by], cmp.bm), b = pickSum(v.items[it][cmp.cy], cmp.cm);
      const r0 = ratioPct(a, pickSum(v.revenue?.[cmp.by], cmp.bm));
      const r1 = ratioPct(b, pickSum(v.revenue?.[cmp.cy], cmp.cm));
      const months = analysisCount(cmp);
      let up = 0; for (let i = 0; i < months; i++) if ((v.items[it][CURRENT_YEAR]?.[i] || 0) > (v.items[it][PREV]?.[i] || 0) * 1.1) up++;
      return {
        item: it,
        prev: a,
        cur: b,
        delta: b - a,
        pct: a ? ((b - a) / a) * 100 : null,
        ratioPrev: r0,
        ratioCur: r1,
        ratioDeltaPp: r0 != null && r1 != null ? r1 - r0 : null,
        avgRatioCurYtd: avgMonthlyRatioPct(v.items[it][CURRENT_YEAR], v.revenue?.[CURRENT_YEAR], range(months)),
        structural: up >= Math.ceil(months * 0.6),
      };
    }).sort((a, b) => b.delta - a.delta);
    out.push({
      name: e.name, region: e.region,
      revPrev: r0, revCur: r1, revPct: r0 ? ((r1 - r0) / Math.abs(r0)) * 100 : null,
      costPrev: c0, costCur: c1, costPct: c0 ? ((c1 - c0) / Math.abs(c0)) * 100 : null,
      gpPrev: g0, gpCur: g1, gpDelta: g1 - g0, turnedLoss: g0 >= 0 && g1 < 0,
      m0, m1, marginPp: (m1 != null && m0 != null) ? m1 - m0 : null,
      rising,                                  // 상승 원가항목(큰 순)
    });
  }
  return out.sort((a, b) => a.gpDelta - b.gpDelta);   // 매출이익 악화 우선
}

// 원가 항목별 비교 (biz로 좁힘) — 전기→당기, 증감 큰 순
export function costItemCompare(region = '전체', clff = '전체', biz = '전체', cmp) {
  const acc = {};
  const revenue = { [PREV]: Array(12).fill(0), [CURRENT_YEAR]: Array(12).fill(0) };
  for (const e of opsList('warehouses', region, clff)) {
    const v = view(e, clff, biz);
    for (let i = 0; i < 12; i++) {
      revenue[PREV][i] += (v.revenue?.[PREV]?.[i] || 0);
      revenue[CURRENT_YEAR][i] += (v.revenue?.[CURRENT_YEAR]?.[i] || 0);
    }
    for (const it of Object.keys(v.items || {})) {
      if (!acc[it]) acc[it] = { [PREV]: Array(12).fill(0), [CURRENT_YEAR]: Array(12).fill(0) };
      for (let i = 0; i < 12; i++) { acc[it][PREV][i] += (v.items[it][PREV]?.[i] || 0); acc[it][CURRENT_YEAR][i] += (v.items[it][CURRENT_YEAR]?.[i] || 0); }
    }
  }
  return Object.entries(acc).map(([item, v]) => {
    const a = pickSum(v[cmp.by], cmp.bm), b = pickSum(v[cmp.cy], cmp.cm);
    const revPrev = pickSum(revenue[cmp.by], cmp.bm);
    const revCur = pickSum(revenue[cmp.cy], cmp.cm);
    const months = analysisCount(cmp);
    const recent3 = recentMonths(months, 3);
    const recent5 = recentMonths(months, 5);
    let up = 0;
    for (let i = 0; i < months; i++) if ((v[CURRENT_YEAR][i] || 0) > (v[PREV][i] || 0) * 1.1) up++;
    const ratioPrev = ratioPct(a, revPrev);
    const ratioCur = ratioPct(b, revCur);
    const avgRatioPrevYear = avgMonthlyRatioPct(v[PREV], revenue[PREV], range(months));
    const avgRatioCurYtd = avgMonthlyRatioPct(v[CURRENT_YEAR], revenue[CURRENT_YEAR], range(months));
    const avgRatioRecent3 = avgMonthlyRatioPct(v[CURRENT_YEAR], revenue[CURRENT_YEAR], recent3);
    const avgRatioRecent5 = avgMonthlyRatioPct(v[CURRENT_YEAR], revenue[CURRENT_YEAR], recent5);
    const avgDeltaPp = ratioCur != null && avgRatioCurYtd != null ? ratioCur - avgRatioCurYtd : null;
    const prevAvgDeltaPp = ratioCur != null && avgRatioPrevYear != null ? ratioCur - avgRatioPrevYear : null;
    const recent3DeltaPp = ratioCur != null && avgRatioRecent3 != null ? ratioCur - avgRatioRecent3 : null;
    const recent5DeltaPp = ratioCur != null && avgRatioRecent5 != null ? ratioCur - avgRatioRecent5 : null;
    return {
      item,
      prev: a,
      cur: b,
      delta: b - a,
      pct: a ? ((b - a) / a) * 100 : null,
      revPrev,
      revCur,
      ratioPrev,
      ratioCur,
      ratioDeltaPp: ratioPrev != null && ratioCur != null ? ratioCur - ratioPrev : null,
      avgRatioCurYtd,
      avgRatioPrevYear,
      avgRatioRecent3,
      avgRatioRecent5,
      avgDeltaPp,
      prevAvgDeltaPp,
      recent3DeltaPp,
      recent5DeltaPp,
      ratioTrend3: ratioTrend(v[CURRENT_YEAR], revenue[CURRENT_YEAR], recent3),
      ratioTrend5: ratioTrend(v[CURRENT_YEAR], revenue[CURRENT_YEAR], recent5),
      ratioOutlier: avgDeltaPp != null && Math.abs(avgDeltaPp) >= 5,
      structural: up >= Math.ceil(months * 0.6),
    };
  }).filter((r) => Math.abs(r.delta) >= 1).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

// 매출 대비 원가율 기준 이탈 항목. 금액 증감과 별개로 평균 비율에서 벗어난 항목을 잡는다.
export function costRatioOutliers(region = '전체', clff = '전체', biz = '전체', cmp, topN = 5, options = {}) {
  const { basis = 'curYtd', thresholdPp = 5 } = options;
  return costItemCompare(region, clff, biz, cmp)
    .map((item) => {
      const baselineRatio = basisValue(item, basis);
      const basisDeltaPp = item.ratioCur != null && baselineRatio != null ? item.ratioCur - baselineRatio : null;
      return {
        ...item,
        basis,
        baselineRatio,
        basisDeltaPp,
        ratioOutlier: basisDeltaPp != null && Math.abs(basisDeltaPp) >= thresholdPp,
      };
    })
    .filter((item) => item.ratioOutlier)
    .sort((a, b) => Math.abs(b.basisDeltaPp || 0) - Math.abs(a.basisDeltaPp || 0))
    .slice(0, topN);
}

// 특정 원가 항목의 증가분이 어느 창고/고객사에서 발생했는지 분해.
// 고객사 원가는 운영 배부 기준이므로 창고 합계와 정확히 일치하지 않을 수 있다.
export function costItemContributors(kind, item, region = '전체', clff = '전체', biz = '전체', cmp, topN = 3, direction = 'increase') {
  const rows = [];
  for (const e of opsList(kind, region, clff)) {
    const v = view(e, clff, biz);
    const itemSeries = v.items?.[item];
    if (!itemSeries) continue;
    const prev = pickSum(itemSeries[cmp.by], cmp.bm);
    const cur = pickSum(itemSeries[cmp.cy], cmp.cm);
    const revPrev = pickSum(v.revenue?.[cmp.by], cmp.bm);
    const revCur = pickSum(v.revenue?.[cmp.cy], cmp.cm);
    const delta = cur - prev;
    if (direction === 'increase' ? delta <= 0 : delta >= 0) continue;
    rows.push({
      name: e.name,
      region: e.region,
      prev,
      cur,
      delta,
      pct: prev ? (delta / Math.abs(prev)) * 100 : null,
      ratioPrev: ratioPct(prev, revPrev),
      ratioCur: ratioPct(cur, revCur),
      ratioDeltaPp: ratioPct(prev, revPrev) != null && ratioPct(cur, revCur) != null
        ? ratioPct(cur, revCur) - ratioPct(prev, revPrev)
        : null,
    });
  }
  const directionTotal = rows.reduce((sum, row) => sum + Math.abs(row.delta), 0);
  return rows
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, topN)
    .map((row) => ({ ...row, share: directionTotal ? (Math.abs(row.delta) / directionTotal) * 100 : null }));
}

// 창고/고객사 개별 셀 기준 데이터 품질 점검.
// 합계에서 상쇄되는 급감도 잡기 위해 엔티티별로 원가 항목을 검사한다.
export function costDataQualityAlerts(kind, region = '전체', clff = '전체', biz = '전체', cmp, topN = 5) {
  const alerts = [];
  for (const e of opsList(kind, region, clff)) {
    const v = view(e, clff, biz);
    for (const [item, itemSeries] of Object.entries(v.items || {})) {
      const prev = pickSum(itemSeries[cmp.by], cmp.bm);
      const cur = pickSum(itemSeries[cmp.cy], cmp.cm);
      if (prev < 100 || cur < 0 || cur > prev * 0.3) continue;
      const ratio = prev ? cur / prev : null;
      const type = cur === 0
        ? 'zero'
        : ratio >= 0.07 && ratio <= 0.13
          ? 'digit'
          : 'drop';
      alerts.push({
        kind,
        entity: e.name,
        region: e.region,
        item,
        prev,
        cur,
        delta: cur - prev,
        pct: prev ? ((cur - prev) / prev) * 100 : null,
        type,
      });
    }
  }
  const severity = { zero: 0, digit: 1, drop: 2 };
  return alerts
    .sort((a, b) => severity[a.type] - severity[b.type] || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, topN);
}

export { PREV as PREV_YEAR };
