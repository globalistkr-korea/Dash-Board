import { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { warehouseMaster, clientContracts, vendors } from '../lib/aggregate';
import { useLang } from '../context/LangContext';

// 탭별: 데이터, 제목 필드, 부제(계약기간) 필드 후보
const TABS = [
  {
    id: 'warehouse', label: '창고',
    data: warehouseMaster,
    title: (r) => r['Warehouse Name'] || r['Warehouse ID'] || '-',
    badges: (r) => [r['Location'], r['Ownership Type']].filter(Boolean),
    period: (r) => [r['Contract Period'], r['Contract end']].filter(Boolean).join(' ~ '),
  },
  {
    id: 'client', label: '고객사',
    data: clientContracts,
    title: (r) => r['Client'] || '-',
    badges: (r) => [r['WH'], r['Contract type']].filter(Boolean),
    period: (r) => [r['Contract start'], r['Contract end']].filter(Boolean).join(' ~ '),
  },
  {
    id: 'vendor', label: '벤더',
    data: vendors,
    title: (r) => r['Vendor Name'] || '-',
    badges: (r) => [r['Operation Scppe'], r['WH Location']].filter(Boolean),
    period: (r) => [r['Contract start (DD/MM/YY)'] || r['Contract start'], r['Contract end']].filter(Boolean).join(' ~ '),
  },
];

const HIDE_EMPTY = (v) => v != null && String(v).trim() !== '' && String(v).trim() !== '-';

export default function ContractPage() {
  const { t, tf, lang } = useLang();
  const [tab, setTab] = useState('warehouse');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  const cfg = TABS.find((t) => t.id === tab);
  const ql = q.trim().toLowerCase();
  const rows = cfg.data.filter((r) =>
    !ql || Object.values(r).some((v) => String(v).toLowerCase().includes(ql))
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-800">{t('계약 정보')}</h1>

      <div className="flex gap-1.5">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => { setTab(tb.id); setOpen(null); }}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors
              ${tab === tb.id ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {t(tb.label)} <span className="opacity-60">{tb.data.length}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lang === 'en' ? 'Search name / warehouse / content' : '이름·창고·내용 검색'}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-8">{lang === 'en' ? 'No results.' : '검색 결과가 없습니다.'}</div>
        )}
        {rows.map((r, i) => {
          const id = `${tab}-${i}`;
          const period = cfg.period(r);
          const isOpen = open === id;
          const entries = Object.entries(r).filter(([, v]) => HIDE_EMPTY(v));
          return (
            <div key={id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : id)}
                className="w-full flex items-center gap-2 px-3.5 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{cfg.title(r)}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {cfg.badges(r).map((b, k) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 truncate max-w-[160px]">{b}</span>
                    ))}
                  </div>
                </div>
                {period && <div className="text-[11px] text-slate-400 shrink-0 text-right max-w-[120px]">{period}</div>}
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 px-3.5 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  {entries.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 py-1 border-b border-slate-50 text-xs">
                      <span className="text-slate-400 shrink-0">{tf(k)}</span>
                      <span className="text-slate-700 text-right break-words">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
