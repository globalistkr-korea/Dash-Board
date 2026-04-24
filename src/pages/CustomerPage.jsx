import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useData } from '../context/DataContext';
import KpiCard from '../components/KpiCard';
import NoData from '../components/NoData';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';

const YEARS = [2023, 2024, 2025, 2026];
const fmt = (v) => (v == null ? '-' : v.toLocaleString());
const pct = (a, b) => (b && b !== 0 ? ((a / b) * 100).toFixed(1) + '%' : '-');

const COLORS = {
  revenue: '#3b82f6',
  grossProfit: '#10b981',
  operatingProfit: '#f59e0b',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2 max-w-[200px] truncate">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="mb-0.5">
          {p.name}: <span className="font-medium">{p.value?.toLocaleString()}백만원</span>
        </p>
      ))}
    </div>
  );
};

export default function CustomerPage({ onNavigate }) {
  const { customerData } = useData();
  const [selectedYear, setSelectedYear] = useState(2025);
  const [filterCorp, setFilterCorp]     = useState('전체');
  const [filterBiz, setFilterBiz]       = useState('전체');
  const [search, setSearch]             = useState('');
  const [sortKey, setSortKey]           = useState('revenue');
  const [sortDir, setSortDir]           = useState('desc');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // 필터 옵션
  const corpOptions  = useMemo(() => {
    if (!customerData) return [];
    return ['전체', ...new Set(customerData.map(c => c.corporation).filter(Boolean))];
  }, [customerData]);

  const bizOptions = ['전체', 'CL', 'FF', 'WM', '기타'];

  // 필터 + 정렬 적용
  const filtered = useMemo(() => {
    if (!customerData) return [];
    return customerData
      .filter(c => {
        const yearOk = c.data?.[selectedYear];
        const corpOk = filterCorp === '전체' || c.corporation === filterCorp;
        const bizOk  = filterBiz  === '전체' || (c.businessArea || '').includes(filterBiz);
        const searchOk = !search || c.customerName?.toLowerCase().includes(search.toLowerCase());
        return yearOk && corpOk && bizOk && searchOk;
      })
      .map(c => ({
        ...c,
        ...c.data[selectedYear].annual,
      }))
      .sort((a, b) => {
        const v = sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey];
        return v;
      });
  }, [customerData, selectedYear, filterCorp, filterBiz, search, sortKey, sortDir]);

  // KPI 합계
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, c) => ({
        revenue: acc.revenue + (c.revenue || 0),
        grossProfit: acc.grossProfit + (c.grossProfit || 0),
        operatingProfit: acc.operatingProfit + (c.operatingProfit || 0),
      }),
      { revenue: 0, grossProfit: 0, operatingProfit: 0 }
    );
  }, [filtered]);

  // Top 10 차트 데이터
  const top10 = useMemo(() => {
    return filtered.slice(0, 10).map(c => ({
      name: c.customerName?.length > 10 ? c.customerName.slice(0, 10) + '…' : c.customerName,
      매출: c.revenue,
      매출이익: c.grossProfit,
      영업이익: c.operatingProfit,
    }));
  }, [filtered]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  if (!customerData) return <NoData onUpload={() => onNavigate('upload')} />;

  return (
    <div className="space-y-5">
      {/* 타이틀 + 연도 선택 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">고객실적</h1>
          <p className="text-sm text-slate-500 mt-0.5">고객사별 매출 · 매출이익 · 영업이익</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {YEARS.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                ${selectedYear === y
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>
              {y}년
            </button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="총 매출" value={`${totals.revenue.toLocaleString()}백만원`}
          sub={`${filtered.length}개 고객사`} color="blue" />
        <KpiCard title="매출이익" value={`${totals.grossProfit.toLocaleString()}백만원`}
          sub={`이익률 ${pct(totals.grossProfit, totals.revenue)}`} color="green" />
        <KpiCard title="영업이익" value={`${totals.operatingProfit.toLocaleString()}백만원`}
          sub={`영업이익률 ${pct(totals.operatingProfit, totals.revenue)}`} color="purple" />
        <KpiCard title="필터 적용" value={`${filtered.length}개`}
          sub="고객사" color="blue" />
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-center">
        {/* 검색 */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="고객사명 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* 법인 필터 */}
        <select value={filterCorp} onChange={e => setFilterCorp(e.target.value)}
          className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          {corpOptions.map(o => <option key={o}>{o}</option>)}
        </select>

        {/* 사업구분 */}
        <select value={filterBiz} onChange={e => setFilterBiz(e.target.value)}
          className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          {bizOptions.map(o => <option key={o}>{o}</option>)}
        </select>

        <span className="text-xs text-slate-400">{filtered.length}개 결과</span>
      </div>

      {/* Top 10 차트 */}
      {top10.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">매출 상위 10개 고객사</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={top10} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}B`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="매출"         fill={COLORS.revenue}         radius={[0,3,3,0]} />
              <Bar dataKey="매출이익"     fill={COLORS.grossProfit}     radius={[0,3,3,0]} />
              <Bar dataKey="영업이익"     fill={COLORS.operatingProfit} radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 고객사 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">고객사 목록 (단위: 백만원)</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-slate-600 font-semibold">고객사명</th>
                <th className="text-left py-3 px-4 text-slate-600 font-semibold">법인</th>
                <th className="text-left py-3 px-4 text-slate-600 font-semibold">사업</th>
                <th className="text-right py-3 px-4 text-slate-600 font-semibold cursor-pointer select-none"
                    onClick={() => handleSort('revenue')}>
                  매출<SortIcon k="revenue" />
                </th>
                <th className="text-right py-3 px-4 text-slate-600 font-semibold cursor-pointer select-none"
                    onClick={() => handleSort('grossProfit')}>
                  매출이익<SortIcon k="grossProfit" />
                </th>
                <th className="text-right py-3 px-4 text-slate-600 font-semibold">이익률</th>
                <th className="text-right py-3 px-4 text-slate-600 font-semibold cursor-pointer select-none"
                    onClick={() => handleSort('operatingProfit')}>
                  영업이익<SortIcon k="operatingProfit" />
                </th>
                <th className="text-right py-3 px-4 text-slate-600 font-semibold">영업이익률</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i}
                  className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedCustomer(selectedCustomer?.customerName === c.customerName ? null : c)}
                >
                  <td className="py-2.5 px-4 font-medium text-slate-800">{c.customerName}</td>
                  <td className="py-2.5 px-4 text-slate-500">{c.corporation}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                      ${c.businessArea === 'CL' ? 'bg-blue-100 text-blue-700' :
                        c.businessArea === 'FF' ? 'bg-purple-100 text-purple-700' :
                        'bg-slate-100 text-slate-600'}`}>
                      {c.businessArea || '-'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-blue-700 font-medium">{fmt(c.revenue)}</td>
                  <td className="py-2.5 px-4 text-right text-emerald-700 font-medium">{fmt(c.grossProfit)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-500">{pct(c.grossProfit, c.revenue)}</td>
                  <td className={`py-2.5 px-4 text-right font-medium ${c.operatingProfit >= 0 ? 'text-amber-700' : 'text-red-500'}`}>
                    {fmt(c.operatingProfit)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-500">{pct(c.operatingProfit, c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-10">조건에 맞는 데이터가 없습니다</p>
          )}
        </div>
      </div>

      {/* 고객 상세 (클릭 시 월별 펼치기) */}
      {selectedCustomer && selectedCustomer.data?.[selectedYear] && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">
              [{selectedCustomer.customerName}] 월별 실적 — {selectedYear}년
            </h2>
            <button onClick={() => setSelectedCustomer(null)}
              className="p-1 hover:bg-slate-100 rounded-full">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-600 font-semibold">월</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-semibold">매출</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-semibold">매출이익</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-semibold">이익률</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-semibold">영업이익</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-semibold">영업이익률</th>
                </tr>
              </thead>
              <tbody>
                {selectedCustomer.data[selectedYear].monthly.map(m => (
                  <tr key={m.month} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-700">{m.label}</td>
                    <td className="py-2 px-3 text-right text-blue-700">{fmt(m.revenue)}</td>
                    <td className="py-2 px-3 text-right text-emerald-700">{fmt(m.grossProfit)}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{pct(m.grossProfit, m.revenue)}</td>
                    <td className={`py-2 px-3 text-right ${m.operatingProfit >= 0 ? 'text-amber-700' : 'text-red-500'}`}>
                      {fmt(m.operatingProfit)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">{pct(m.operatingProfit, m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
