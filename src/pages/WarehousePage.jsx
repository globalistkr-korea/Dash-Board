import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useData } from '../context/DataContext';
import KpiCard from '../components/KpiCard';
import NoData from '../components/NoData';
import { Search, X } from 'lucide-react';

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
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value?.toLocaleString()}백만원</span>
        </p>
      ))}
    </div>
  );
};

export default function WarehousePage({ onNavigate }) {
  const { warehouseData } = useData();
  const [filterRegion, setFilterRegion]   = useState('전체');
  const [filterBizType, setFilterBizType] = useState('전체');
  const [search, setSearch]               = useState('');
  const [sortKey, setSortKey]             = useState('revenue');
  const [sortDir, setSortDir]             = useState('desc');
  const [selectedCenter, setSelectedCenter] = useState(null);

  // 필터 옵션
  const regionOptions = useMemo(() => {
    if (!warehouseData) return [];
    return ['전체', ...new Set(warehouseData.map(w => w.region).filter(Boolean))];
  }, [warehouseData]);

  const bizTypeOptions = useMemo(() => {
    if (!warehouseData) return [];
    return ['전체', ...new Set(warehouseData.map(w => w.businessType).filter(Boolean))];
  }, [warehouseData]);

  // 필터 + 정렬
  const filtered = useMemo(() => {
    if (!warehouseData) return [];
    return warehouseData
      .filter(w => {
        const regionOk  = filterRegion  === '전체' || w.region      === filterRegion;
        const bizOk     = filterBizType === '전체' || w.businessType === filterBizType;
        const searchOk  = !search || w.center?.toLowerCase().includes(search.toLowerCase());
        return regionOk && bizOk && searchOk;
      })
      .sort((a, b) => {
        const va = a.annual?.[sortKey] || 0;
        const vb = b.annual?.[sortKey] || 0;
        return sortDir === 'desc' ? vb - va : va - vb;
      });
  }, [warehouseData, filterRegion, filterBizType, search, sortKey, sortDir]);

  // KPI 합계
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, w) => ({
        revenue: acc.revenue + (w.annual?.revenue || 0),
        grossProfit: acc.grossProfit + (w.annual?.grossProfit || 0),
        operatingProfit: acc.operatingProfit + (w.annual?.operatingProfit || 0),
      }),
      { revenue: 0, grossProfit: 0, operatingProfit: 0 }
    );
  }, [filtered]);

  // Top 10 차트
  const top10 = useMemo(() => {
    return filtered.slice(0, 10).map(w => ({
      name: w.center?.length > 12 ? w.center.slice(0, 12) + '…' : w.center,
      매출: w.annual?.revenue || 0,
      매출이익: w.annual?.grossProfit || 0,
      영업이익: w.annual?.operatingProfit || 0,
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

  if (!warehouseData) return <NoData onUpload={() => onNavigate('upload')} />;

  return (
    <div className="space-y-5">
      {/* 타이틀 */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">창고실적</h1>
        <p className="text-sm text-slate-500 mt-0.5">센터별 매출 · 매출이익 · 영업이익</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="총 매출" value={`${totals.revenue.toLocaleString()}백만원`}
          sub={`${filtered.length}개 센터`} color="blue" />
        <KpiCard title="매출이익" value={`${totals.grossProfit.toLocaleString()}백만원`}
          sub={`이익률 ${pct(totals.grossProfit, totals.revenue)}`} color="green" />
        <KpiCard title="영업이익" value={`${totals.operatingProfit.toLocaleString()}백만원`}
          sub={`영업이익률 ${pct(totals.operatingProfit, totals.revenue)}`} color="purple" />
        <KpiCard title="필터 결과" value={`${filtered.length}개`} sub="센터" color="blue" />
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="센터명 검색" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
          className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          {regionOptions.map(o => <option key={o}>{o}</option>)}
        </select>

        <select value={filterBizType} onChange={e => setFilterBizType(e.target.value)}
          className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          {bizTypeOptions.map(o => <option key={o}>{o}</option>)}
        </select>

        <span className="text-xs text-slate-400">{filtered.length}개 결과</span>
      </div>

      {/* Top 10 차트 */}
      {top10.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">매출 상위 10개 센터</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top10} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}B`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="매출"         fill={COLORS.revenue}         radius={[0,3,3,0]} />
              <Bar dataKey="매출이익"     fill={COLORS.grossProfit}     radius={[0,3,3,0]} />
              <Bar dataKey="영업이익"     fill={COLORS.operatingProfit} radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 창고 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">센터 목록 (단위: 백만원)</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-slate-600 font-semibold">센터명</th>
                <th className="text-left py-3 px-4 text-slate-600 font-semibold">법인</th>
                <th className="text-left py-3 px-4 text-slate-600 font-semibold">지역</th>
                <th className="text-left py-3 px-4 text-slate-600 font-semibold">사업군</th>
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
              {filtered.map((w, i) => (
                <tr key={i}
                  className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedCenter(selectedCenter?.center === w.center ? null : w)}
                >
                  <td className="py-2.5 px-4 font-medium text-slate-800">{w.center}</td>
                  <td className="py-2.5 px-4 text-slate-500">{w.corporation}</td>
                  <td className="py-2.5 px-4 text-slate-500">{w.region || '-'}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                      {w.businessType || '-'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-blue-700 font-medium">{fmt(w.annual?.revenue)}</td>
                  <td className="py-2.5 px-4 text-right text-emerald-700 font-medium">{fmt(w.annual?.grossProfit)}</td>
                  <td className="py-2.5 px-4 text-right text-slate-500">{pct(w.annual?.grossProfit, w.annual?.revenue)}</td>
                  <td className={`py-2.5 px-4 text-right font-medium ${(w.annual?.operatingProfit || 0) >= 0 ? 'text-amber-700' : 'text-red-500'}`}>
                    {fmt(w.annual?.operatingProfit)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-500">{pct(w.annual?.operatingProfit, w.annual?.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-10">조건에 맞는 데이터가 없습니다</p>
          )}
        </div>
      </div>

      {/* 센터 상세 (클릭 시 월별) */}
      {selectedCenter && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">
              [{selectedCenter.center}] 월별 실적
            </h2>
            <button onClick={() => setSelectedCenter(null)} className="p-1 hover:bg-slate-100 rounded-full">
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
                {selectedCenter.monthly.map(m => (
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
