import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area
} from 'recharts';
import { useData } from '../context/DataContext';
import KpiCard from '../components/KpiCard';
import NoData from '../components/NoData';

const YEARS = [2023, 2024, 2025, 2026];
const fmt  = (v) => v == null ? '-' : `${v.toLocaleString()}`;
const fmtM = (v) => v == null ? '-' : `${v.toLocaleString()}백만원`;
const pct  = (a, b) => b && b !== 0 ? ((a / b) * 100).toFixed(1) + '%' : '-';

const COLORS = {
  revenue:         '#3b82f6',
  grossProfit:     '#10b981',
  operatingProfit: '#f59e0b',
};

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="mb-0.5">
          {p.name}: <span className="font-medium">{p.value?.toLocaleString()}백만원</span>
        </p>
      ))}
    </div>
  );
};

export default function PlanPage({ onNavigate }) {
  const { planData } = useData();
  const [selectedYear, setSelectedYear] = useState(2026);
  const [viewType, setViewType] = useState('bar'); // 'bar' | 'line'

  const yearData = planData?.[selectedYear];
  const prevYearData = planData?.[selectedYear - 1];

  // 연도 비교 데이터 (연간 합계)
  const annualCompare = useMemo(() => {
    return YEARS
      .filter(y => planData?.[y])
      .map(y => ({
        year: `${y}년`,
        매출: planData[y].annual?.revenue || 0,
        매출이익: planData[y].annual?.grossProfit || 0,
        영업이익: planData[y].annual?.operatingProfit || 0,
      }));
  }, [planData]);

  if (!planData) {
    return <NoData onUpload={() => onNavigate('upload')} />;
  }

  const annual = yearData?.annual || {};
  const prevAnnual = prevYearData?.annual || {};
  const growthRate = prevAnnual.revenue
    ? ((annual.revenue - prevAnnual.revenue) / prevAnnual.revenue * 100)
    : null;

  const monthlyChartData = yearData?.monthly?.map(m => ({
    name: m.label,
    매출: m.revenue,
    매출이익: m.grossProfit,
    영업이익: m.operatingProfit,
  })) || [];

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">경영계획 실적</h1>
          <p className="text-sm text-slate-500 mt-0.5">연도별 / 월별 매출 · 매출이익 · 영업이익</p>
        </div>
        {/* 연도 선택 */}
        <div className="flex items-center gap-2 flex-wrap">
          {YEARS.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              disabled={!planData[y]}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                ${selectedYear === y
                  ? 'bg-blue-600 text-white shadow'
                  : planData[y]
                    ? 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
            >
              {y}년{y === 2026 ? ' (계획)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="연간 매출"
          value={`${(annual.revenue || 0).toLocaleString()}백만원`}
          sub={`${selectedYear}년 합계`}
          color="blue"
          trend={growthRate}
        />
        <KpiCard
          title="매출이익"
          value={`${(annual.grossProfit || 0).toLocaleString()}백만원`}
          sub={`이익률 ${pct(annual.grossProfit, annual.revenue)}`}
          color="green"
        />
        <KpiCard
          title="영업이익"
          value={`${(annual.operatingProfit || 0).toLocaleString()}백만원`}
          sub={`영업이익률 ${pct(annual.operatingProfit, annual.revenue)}`}
          color="purple"
        />
        <KpiCard
          title="전년 대비 매출"
          value={prevAnnual.revenue ? `${(prevAnnual.revenue).toLocaleString()}백만원` : '-'}
          sub={`${selectedYear - 1}년 실적`}
          color="blue"
        />
      </div>

      {/* 연도 비교 차트 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">연도별 비교 (연간 합계)</h2>
        {annualCompare.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={annualCompare} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}B`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="매출"         fill={COLORS.revenue}         radius={[3,3,0,0]} />
              <Bar dataKey="매출이익"     fill={COLORS.grossProfit}     radius={[3,3,0,0]} />
              <Bar dataKey="영업이익"     fill={COLORS.operatingProfit} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 text-center py-10">데이터 없음</p>
        )}
      </div>

      {/* 월별 차트 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">
            {selectedYear}년 월별 실적{selectedYear === 2026 ? ' (계획)' : ''}
          </h2>
          <div className="flex gap-1">
            {['bar', 'line'].map(t => (
              <button
                key={t}
                onClick={() => setViewType(t)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors
                  ${viewType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {t === 'bar' ? '막대' : '선형'}
              </button>
            ))}
          </div>
        </div>

        {yearData ? (
          <ResponsiveContainer width="100%" height={260}>
            {viewType === 'bar' ? (
              <BarChart data={monthlyChartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}B`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="매출"         fill={COLORS.revenue}         radius={[3,3,0,0]} />
                <Bar dataKey="매출이익"     fill={COLORS.grossProfit}     radius={[3,3,0,0]} />
                <Bar dataKey="영업이익"     fill={COLORS.operatingProfit} radius={[3,3,0,0]} />
              </BarChart>
            ) : (
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}B`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="매출"         stroke={COLORS.revenue}         strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="매출이익"     stroke={COLORS.grossProfit}     strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="영업이익"     stroke={COLORS.operatingProfit} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 text-center py-10">{selectedYear}년 데이터가 없습니다</p>
        )}
      </div>

      {/* 월별 상세 테이블 */}
      {yearData && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">월별 상세 (단위: 백만원)</h2>
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
                {yearData.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-medium text-slate-700">{m.label}</td>
                    <td className="py-2 px-3 text-right text-blue-700 font-medium">{fmt(m.revenue)}</td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-medium">{fmt(m.grossProfit)}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{pct(m.grossProfit, m.revenue)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${m.operatingProfit >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                      {fmt(m.operatingProfit)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">{pct(m.operatingProfit, m.revenue)}</td>
                  </tr>
                ))}
                {/* 합계 행 */}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="py-2.5 px-3 text-slate-700">합계</td>
                  <td className="py-2.5 px-3 text-right text-blue-700">{fmt(annual.revenue)}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-700">{fmt(annual.grossProfit)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{pct(annual.grossProfit, annual.revenue)}</td>
                  <td className={`py-2.5 px-3 text-right ${annual.operatingProfit >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                    {fmt(annual.operatingProfit)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{pct(annual.operatingProfit, annual.revenue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
