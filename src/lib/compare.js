// 월간 비교(당월/누계 계획比·전년비·전월비) 데이터. 단위: 백만원.
import raw from '../data/plan_compare.json';

export const CMP = raw;
export const CMP_METRICS = Object.keys(raw.metrics);     // ['매출','영업이익']
export const CMP_MONTH = raw.monthLabel;                 // '5월'

// 증감률(%) cur/base
export const ratio = (cur, base) => (base ? ((cur - base) / Math.abs(base)) * 100 : null);
// 달성률(%) = 실적/계획
export const attain = (act, plan) => (plan ? (act / plan) * 100 : null);
