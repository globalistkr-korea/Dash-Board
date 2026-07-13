// 창고별/고객사별 월별 실적·원가 셀렉터 + 운영 원가 이상탐지.
// 원본 단위: mil VND(백만동). 표시: 매출·직접원가=bil VND(÷1000), 이익·원가항목=mil VND
// 세그먼트: 창고/운송/FF/기타 (CL = 창고+운송). entity.data[seg]{revenue/.../items}.
import raw from '../data/ops.json';

export const OPS_YEARS = raw.years;                 // ['2025','2026']
export const OPS_CURRENT = OPS_YEARS[OPS_YEARS.length - 1];
export const COST_ITEMS = raw.costItems;
const ACTUAL = { '2025': 12, '2026': 5 };
export const opsActualCount = (y) => ACTUAL[y] ?? 12;
export const EOKDONG = 100;                          // 이상탐지 기준 변동액 = 100 mil VND
const FIELDS = ['revenue', 'directCost', 'grossProfit', 'opProfit'];

const sum = (a) => (a || []).reduce((x, v) => x + (v || 0), 0);
const blankY = () => Object.fromEntries(OPS_YEARS.map((y) => [y, Array(12).fill(0)]));
const addInto = (acc, arr) => { for (let i = 0; i < 12; i++) acc[i] += (arr?.[i] || 0); };

// (사업 clff, 구분 biz) → 합산할 세그먼트 키 목록
export function segKeys(e, clff = '전체', biz = '전체') {
  const segs = e.segs || Object.keys(e.data || {});
  if (clff === 'CL') {
    if (biz === '운송') return segs.filter((s) => s === '운송');
    if (biz === '창고') return segs.filter((s) => s === '창고');
    return segs.filter((s) => s === '운송' || s === '창고');
  }
  if (clff === 'FF') return segs.filter((s) => s === 'FF');
  if (clff === '기타') return segs.filter((s) => s === '기타');
  return segs; // 전체
}

// 선택 세그먼트 합산 뷰 {revenue/.../opProfit{y:[12]}, items{name:{y:[12]}}}
export function view(e, clff = '전체', biz = '전체') {
  const keys = segKeys(e, clff, biz);
  const acc = {};
  for (const f of FIELDS) acc[f] = blankY();
  acc.items = {};
  for (const k of keys) {
    const d = e.data?.[k];
    if (!d) continue;
    for (const f of FIELDS) for (const y of OPS_YEARS) addInto(acc[f][y], d[f]?.[y]);
    for (const [it, mp] of Object.entries(d.items || {})) {
      if (!acc.items[it]) acc.items[it] = blankY();
      for (const y of OPS_YEARS) addInto(acc.items[it][y], mp?.[y]);
    }
  }
  return acc;
}

// 엔티티 목록(region/clff 멤버십 필터) — 정렬은 호출부에서 뷰로
export function opsList(kind, region = '전체', clff = '전체') {
  return Object.entries(raw[kind] || {})
    .map(([name, e]) => ({ name, ...e }))
    .filter((e) => region === '전체' || e.region === region)
    .filter((e) => clff === '전체' || (e.clff || []).includes(clff));
}
export const opsGet = (kind, name) => {
  const e = raw[kind]?.[name];
  return e ? { name, ...e } : null;
};

// 집계 (v = view 객체)
export const annualOf = (v, field, year) => sum(v?.[field]?.[year]);
export const ytdOf = (v, field, year) => sum((v?.[field]?.[year] || []).slice(0, opsActualCount(year)));
export function yoyOf(v, field) {
  const i = OPS_YEARS.indexOf(OPS_CURRENT);
  if (i <= 0) return null;
  const n = opsActualCount(OPS_CURRENT);
  const prev = sum((v?.[field]?.[OPS_YEARS[i - 1]] || []).slice(0, n));
  const cur = sum((v?.[field]?.[OPS_CURRENT] || []).slice(0, n));
  return prev ? ((cur - prev) / Math.abs(prev)) * 100 : null;
}

// 원가 항목 월별 이상: 변동액 ≥ 1억동 + 변동률 ≥ 임계 (금액변동 큰 순). v=view
export function anomaliesOf(v, { threshold = 0.3, baseline = EOKDONG } = {}) {
  const out = [];
  for (const year of OPS_YEARS) {
    const n = opsActualCount(year);
    for (const item of Object.keys(v.items || {})) {
      const s = v.items[item]?.[year] || [];
      for (let m = 1; m < n; m++) {
        const cur = s[m] || 0, prev = s[m - 1] || 0;
        const delta = cur - prev;
        if (Math.abs(delta) < baseline) continue;
        // 전월이 음수(정산/조정)여도 |전월| 기준 변동률로 임계 검사 — 우회 방지.
        // chg=null(='신규' 표기)은 전월이 정확히 0일 때만.
        const chg = prev !== 0 ? delta / Math.abs(prev) : null;
        if (chg != null && Math.abs(chg) < threshold) continue;
        out.push({ item, year, month: m + 1, prev, cur, chg, delta });
      }
    }
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function allAnomalies(kind, region = '전체', clff = '전체', biz = '전체', opts = {}) {
  const res = [];
  for (const e of opsList(kind, region, clff)) {
    for (const a of anomaliesOf(view(e, clff, biz), opts))
      res.push({ entity: e.name, region: e.region, ...a });
  }
  return res.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// 원가 항목별 YTD 합계(큰 순). v=view
// 주의: total>0 필터를 쓰면 YTD가 0/음수인데 월별 급변 플래그가 있는 항목이
// 화면에서 사라진다 → 해당 연도에 0이 아닌 달이 하나라도 있으면 표시.
export function itemRanking(v, year = OPS_CURRENT) {
  return Object.keys(v.items || {})
    .map((item) => ({ item, total: ytdOf({ [item]: v.items[item] }, item, year), series: v.items[item] }))
    .filter((x) => (x.series?.[year] || []).some((val) => val !== 0))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}
