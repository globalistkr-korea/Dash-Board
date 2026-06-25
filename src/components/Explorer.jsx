import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useUnit } from '../context/UnitContext';
import { fmtMoney, unitLabel, fmtPct, margin, deltaColor } from '../lib/format';
import { groupBy, totals, filterClff, filterRegion, raw } from '../lib/aggregate';
import KpiCard from './KpiCard';
import ShareBar from './ShareBar';

const CLFF = [
  { id: 'all', label: '전체' },
  { id: 'CL', label: 'CL' },
  { id: 'FF', label: 'FF' },
];

const REGIONS = [
  { id: 'all', label: '전체' },
  { id: '북부', label: '북부' },
  { id: '남부', label: '남부' },
];

// 창고별/고객사별 공용 탐색 화면.
// groupKey: 'warehouse' | 'customer'  /  childKey: 드릴다운 기준
export default function Explorer({ title, groupKey, childKey, groupNoun, childNoun }) {
  const { unit, rate } = useUnit();
  const [clff, setClff] = useState('all');
  const [region, setRegion] = useState('all');
  const [open, setOpen] = useState(null);

  const rows = filterRegion(filterClff(raw, clff), region);
  const groups = groupBy(rows, (r) => r[groupKey]);
  const t = totals(rows);
  const opMargin = margin(t.opProfit, t.revenue);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-800">{title}</h1>
        <div className="flex gap-1.5">
          {CLFF.map((c) => {
            const disabled = c.id !== 'all' && !raw.some((r) => r.clff === c.id);
            return (
              <button
                key={c.id}
                disabled={disabled}
                onClick={() => setClff(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                  ${clff === c.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}
                  ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 남/북부 구분 (핵심 필터) */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 shrink-0">지역</span>
        <div className="flex gap-1.5">
          {REGIONS.map((rg) => {
            const disabled = rg.id !== 'all' && !raw.some((r) => r.region === rg.id);
            return (
              <button
                key={rg.id}
                disabled={disabled}
                onClick={() => setRegion(rg.id)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${region === rg.id ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 border border-slate-200'}
                  ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                title={disabled ? '데이터 입력 전' : ''}
              >
                {rg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 합계 KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard label="매출" value={t.revenue} accent="blue" />
        <KpiCard label="매출이익" value={t.grossProfit} accent="slate" />
        <KpiCard label="영업이익" value={t.opProfit} accent={t.opProfit >= 0 ? 'green' : 'red'} />
        <KpiCard label="영업이익률" isMoney={false} value={fmtPct(opMargin)} accent={opMargin >= 0 ? 'green' : 'red'} />
      </div>

      {/* 그룹 목록 */}
      <div className="space-y-2">
        {groups.map((g) => {
          const gm = margin(g.opProfit, g.revenue);
          const children = open === g.key ? groupBy(g.rows, (r) => r[childKey]) : [];
          return (
            <div key={g.key} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => setOpen(open === g.key ? null : g.key)}
                className="w-full flex items-center gap-2 px-3.5 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                {open === g.key ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{g.key}</div>
                  <div className="text-[11px] text-slate-400">{g.count}개 {childNoun} · 매출 {fmtMoney(g.revenue, unit, rate)} {unitLabel(unit)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold tabular-nums ${deltaColor(g.opProfit)}`}>{fmtMoney(g.opProfit, unit, rate)}</div>
                  <div className="text-[11px] text-slate-400">영업이익 {fmtPct(gm)}</div>
                </div>
              </button>

              <div className="px-3.5 pb-3">
                <ShareBar data={g} />
              </div>

              {open === g.key && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-2 py-2 space-y-1">
                  <div className="text-[11px] text-slate-400 px-2 pb-1">{childNoun}별 내역</div>
                  {children.map((c) => {
                    const cm = margin(c.opProfit, c.revenue);
                    return (
                      <div key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-slate-100">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-700 truncate">{c.key}</div>
                          <div className="text-[10px] text-slate-400">매출 {fmtMoney(c.revenue, unit, rate)}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xs font-semibold tabular-nums ${deltaColor(c.opProfit)}`}>{fmtMoney(c.opProfit, unit, rate)}</div>
                          <div className="text-[10px] text-slate-400">{fmtPct(cm)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 text-center">단위: {unitLabel(unit)} · 참고용, 원본 시트와 교차확인 권장</p>
    </div>
  );
}
