import { useUnit } from '../context/UnitContext';
import { fmtMoney, unitLabel } from '../lib/format';

// 금액 KPI 카드. value는 백만동 기준.
// display/unitText를 주면 사전 포맷된 문자열을 그대로 표시(경영계획 원화 단위 등).
export default function KpiCard({ label, value, sub, accent = 'blue', isMoney = true, display, unitText }) {
  const { unit, rate } = useUnit();
  const accents = {
    blue:  'text-blue-700',
    green: 'text-emerald-600',
    red:   'text-red-500',
    slate: 'text-slate-700',
  };
  const usePreformatted = display != null;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3.5">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${accents[accent] || accents.blue}`}>
        {usePreformatted ? display : (isMoney ? fmtMoney(value, unit, rate) : value)}
        {(usePreformatted ? unitText : (isMoney && unitLabel(unit))) && (
          <span className="text-xs font-normal text-slate-400 ml-1">
            {usePreformatted ? unitText : unitLabel(unit)}
          </span>
        )}
      </div>
      {sub != null && <div className="text-xs mt-1 text-slate-500">{sub}</div>}
    </div>
  );
}
