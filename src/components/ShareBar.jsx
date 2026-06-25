import { useUnit } from '../context/UnitContext';
import { fmtMoney, unitLabel } from '../lib/format';

// 보관 / 핸들링 / 운송 비중 가로 막대
const SEGS = [
  { key: 'storage',   label: '보관',   color: '#2563eb' },
  { key: 'handling',  label: '핸들링', color: '#0ea5e9' },
  { key: 'transport', label: '운송',   color: '#14b8a6' },
];

export default function ShareBar({ data, showValues = false }) {
  const { unit, rate } = useUnit();
  const total = SEGS.reduce((a, s) => a + (data[s.key] || 0), 0);
  if (!total) return <div className="text-[11px] text-slate-300">보관/핸들링/운송 데이터 없음</div>;

  return (
    <div className="space-y-1">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
        {SEGS.map((s) => {
          const pct = ((data[s.key] || 0) / total) * 100;
          return pct > 0 ? (
            <div key={s.key} style={{ width: `${pct}%`, background: s.color }} title={`${s.label} ${pct.toFixed(0)}%`} />
          ) : null;
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        {SEGS.map((s) => {
          const v = data[s.key] || 0;
          const pct = total ? (v / total) * 100 : 0;
          return (
            <span key={s.key} className="flex items-center gap-1">
              <i className="w-2 h-2 rounded-sm inline-block" style={{ background: s.color }} />
              {s.label} {pct.toFixed(0)}%
              {showValues && <span className="text-slate-400">({fmtMoney(v, unit, rate)}{unit === 'krw' ? '' : ''})</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
