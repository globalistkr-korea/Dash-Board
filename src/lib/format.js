// 모든 금액 값은 '백만동(VND mn)' 단위를 기준으로 다룬다.
// 원화 토글 시 백만동 × rate(0.056) = 백만원.

import { KRW_REFERENCE_RATE, smallMoneyLabel, largeMoneyLabel, formatSmallMoney, formatLargeMoney } from './currency';
export const KRW_RATE_DEFAULT = KRW_REFERENCE_RATE;

export function fmtNum(v, digits = 0) {
  if (v == null || isNaN(v)) return '-';
  return Number(v).toLocaleString('ko-KR', { maximumFractionDigits: digits });
}

// vndMillion(백만동) → 화면 표시 숫자
export function fmtMoney(vndMillion, unit, rate = KRW_RATE_DEFAULT) {
  if (vndMillion == null || isNaN(vndMillion)) return '-';
  if (unit === 'krw') return fmtNum(vndMillion * rate, 0);
  return fmtNum(vndMillion, 0);
}

export const unitLabel = (unit) => (unit === 'krw' ? '백만원' : '백만동');

// 손익 화면: 큰 금액은 십억동/억원, 이익·원가는 백만동/백만원.
const EOK_METRICS = new Set(['매출', '매출원가']);
export const planUnitLabel = (metric) => (EOK_METRICS.has(metric) ? largeMoneyLabel() : smallMoneyLabel());

// 백만동(기준값) → 경영계획 표시 숫자(원화)
export function fmtPlan(vndMillion, metric, rate = KRW_RATE_DEFAULT, digits) {
  if (vndMillion == null || isNaN(vndMillion)) return '-';
  const krwMn = vndMillion * rate;                 // 백만원
  if (metric === '매출') return fmtNum(krwMn / 100, digits ?? 1); // 억원
  return fmtNum(krwMn, digits ?? 0);               // 백만원
}

// 기존 함수명 유지. 입력은 백만동이며, 선택 통화로 표시만 환산한다.
export function fmtKrwMetric(krwMn, metric, digits) {
  if (krwMn == null || isNaN(krwMn)) return '-';
  void digits;
  return EOK_METRICS.has(metric) ? formatLargeMoney(krwMn) : formatSmallMoney(krwMn);
}

// 비율(%) 표시
export function fmtPct(v, digits = 1) {
  if (v == null || isNaN(v)) return '-';
  return `${Number(v).toLocaleString('ko-KR', { maximumFractionDigits: digits })}%`;
}

// 이익률
export const margin = (profit, revenue) =>
  revenue ? (profit / revenue) * 100 : null;

// 증감 색상 (이익/증가=파랑, 손실/감소=빨강)
export const deltaColor = (v) =>
  v == null ? 'text-slate-400' : v >= 0 ? 'text-blue-600' : 'text-red-500';
