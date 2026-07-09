import { lazy, Suspense, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import {
  YEARS, PL_METRICS, CURRENT_YEAR, monthsMeta, actualCount,
  series, annual, ytd, yoy, marginPct, subtypeList, insights,
} from '../lib/plan3y';
import { fmtKrwMetric, planUnitLabel, fmtPct, deltaColor } from '../lib/format';
import { CMP, CMP_METRICS, CMP_MONTH, ratio, attain } from '../lib/compare';
import { opsList as opsL, view as opsView, annualOf as opsAnnual, OPS_CURRENT } from '../lib/ops';
import { marginDiagnosis, cmpYTD, cmpMoM, cmpYoYMonth, subtypeToBiz, entityDetails, costItemCompare } from '../lib/variance';
import { useLang } from '../context/LangContext';

// 1,400줄 보고 브리핑(+Firebase 연동)은 지연 로딩 — 첫 화면 번들에서 분리
const ReportBriefing = lazy(() => import('../components/ReportBriefing'));

const TABS = ['요약', ...PL_METRICS];
const RATIO_LABEL = { 매출원가: '원가율', 매출이익: '매출이익률', 판관비: '판관비율', 영업이익: '영업이익률' };
const CLFF = ['전체', 'CL', 'FF'];
const REGIONS = ['전체', '남부', '북부'];
const YEAR_COLOR = { '2024': '#cbd5e1', '2025': '#60a5fa', '2026': '#1d4ed8' };

const disp = (v, m) => fmtKrwMetric(v, m);
const deltaTag = (v) =>
  v == null ? <span className="text-slate-300">-</span>
    : <span className={deltaColor(v)}>{`${v >= 0 ? '▲' : '▼'}${Math.abs(v).toFixed(1)}%`}</span>;

function Chip({ active, onClick, children, accent = 'slate' }) {
  const { t } = useLang();
  const on = accent === 'blue' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-white';
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
        ${active ? on : 'bg-white text-slate-600 border border-slate-200'}`}>
      {typeof children === 'string' ? t(children) : children}
    </button>
  );
}

function FilterLabel({ ko }) {
  const { t } = useLang();
  return <span className="w-12 text-slate-400">{t(ko)}</span>;
}

export default function PlanPage() {
  const { t, lang } = useLang();
  const [mode, setMode] = useState('월간 비교');
  const [tab, setTab] = useState('요약');
  const [clff, setClff] = useState('전체');
  const [region, setRegion] = useState('북부');   // 북부 담당자 기본
  const [subtype, setSubtype] = useState('전체');

  const subOpts = subtypeList(clff);
  const setClffReset = (c) => { setClff(c); setSubtype('전체'); };

  const scopeLabel = [clff !== '전체' && clff, subtype !== '전체' && subtype, region !== '전체' && region]
    .filter(Boolean).join(' · ') || '베트남 전체';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-800">{lang === 'en' ? 'P&L Plan · Actual' : '경영계획 · 실적'} <span className="text-sm font-normal text-slate-400">{lang === 'en' ? '3-Year' : '3개년'}</span></h1>
        <span className="text-xs text-slate-400">{lang === 'en' ? `Actual through ${CURRENT_YEAR}.${actualCount(CURRENT_YEAR)}, then plan` : `${CURRENT_YEAR}년 ${actualCount(CURRENT_YEAR)}월까지 실적 · 이후 계획`}</span>
      </div>

      {/* 연간 / 월간 모드 */}
      <div className="inline-flex bg-slate-200/70 rounded-full p-0.5">
        {['연간 비교', '월간 비교'].map((mo) => (
          <button key={mo} onClick={() => setMode(mo)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors
              ${mode === mo ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
            {t(mo)}
          </button>
        ))}
      </div>

      {/* 지표 탭 (연간 모드) */}
      {mode === '연간 비교' && (
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors
                ${tab === tb ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
              {t(tb)}
            </button>
          ))}
        </div>
      )}

      {/* 필터: 지역 → 사업 → 세부 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <FilterLabel ko="지역" />
          {REGIONS.map((r) => <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{r}</Chip>)}
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <FilterLabel ko="사업" />
          {CLFF.map((c) => <Chip key={c} active={clff === c} onClick={() => setClffReset(c)}>{c}</Chip>)}
        </div>
        {subOpts.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <FilterLabel ko="세부" en="Detail" />
            <Chip active={subtype === '전체'} onClick={() => setSubtype('전체')}>전체</Chip>
            {subOpts.map((s) => <Chip key={s} active={subtype === s} onClick={() => setSubtype(s)}>{s}</Chip>)}
          </div>
        )}
      </div>

      <div className="text-[11px] text-slate-400">현재 보기: <b className="text-slate-600">{scopeLabel}</b> · 단위: 매출 억원 / 매출이익·영업이익 백만원</div>

      <InsightCard clff={clff} region={region} />

      {mode === '월간 비교'
        ? <MonthlyView clff={clff} region={region} subtype={subtype} />
        : tab === '요약'
          ? <SummaryView clff={clff} region={region} subtype={subtype} />
          : <MetricView metric={tab} clff={clff} region={region} subtype={subtype}
              onRow={(r) => { if (r.setClff) setClffReset(r.setClff); if (r.setSub) setSubtype(r.setSub); if (r.setRegion) setRegion(r.setRegion); }} />}

      <ConstituentCard clff={clff} region={region} />

      <p className="text-[11px] text-slate-400 text-center">출처: 구글시트 ‘대쉬보드’ 지역 탭 · 참고용, 원본과 교차확인 권장</p>
    </div>
  );
}

/* 구성 Top 컬럼 (모듈 레벨 — 렌더 중 생성 금지) */
function ConstituentCol({ title, list }) {
  return (
    <div className="flex-1 min-w-[160px]">
      <div className="text-[11px] font-semibold text-slate-500 mb-1">{title}</div>
      {list.map((x, i) => (
        <div key={x.name} className="flex justify-between gap-2 text-xs py-0.5 border-b border-slate-50 last:border-0">
          <span className="text-slate-600 truncate"><span className="text-slate-300 mr-1">{i + 1}</span>{x.name}</span>
          <span className="tabular-nums text-slate-700 shrink-0">{(x.rev / 100).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
        </div>
      ))}
    </div>
  );
}

/* 구성 Top 고객/창고 — 경영계획 숫자를 "누가 구성하나" (운영 데이터/동 기준) */
function ConstituentCard({ clff, region }) {
  const { lang } = useLang();
  const top = (kind) => opsL(kind, region, clff)
    .map((e) => ({ name: e.name, region: e.region, rev: opsAnnual(opsView(e, clff, '전체'), 'revenue', OPS_CURRENT) }))
    .filter((x) => x.rev > 0)
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 5);
  const cust = top('customers'), wh = top('warehouses');
  if (!cust.length && !wh.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{lang === 'en' ? 'Top constituents' : '구성 Top'} <span className="text-[11px] font-normal text-slate-400">{lang === 'en' ? 'who drives this' : '이 숫자=누가'}</span></span>
        <span className="text-[11px] text-slate-400">{OPS_CURRENT} · {lang === 'en' ? '억dong' : '억동'}</span>
      </div>
      <div className="flex gap-4 flex-wrap">
        <ConstituentCol title={lang === 'en' ? 'Top Customers' : '고객 Top 5'} list={cust} />
        <ConstituentCol title={lang === 'en' ? 'Top Warehouses' : '창고 Top 5'} list={wh} />
      </div>
      <div className="text-[10px] text-slate-400 mt-1.5">{lang === 'en' ? '※ Operational data (VND dong) — different source/unit from P&L (KRW); for context, not exact match.' : '※ 운영 데이터(동) 기준 — 경영계획(원)과 출처·단위 달라 정확 일치 아님. 구성 파악용 참고.'}</div>
    </div>
  );
}

/* ── 인사이트 (+ 참고용 미니 차트) ────────────────────────── */
function InsightCard({ clff, region }) {
  const [open, setOpen] = useState(true);
  const items = insights(clff, region);
  if (!items.length) return null;
  const icon = { up: '📈', down: '📉', warn: '⚠️', info: '💡' };
  const color = { up: 'text-blue-700', down: 'text-red-500', warn: 'text-amber-600', info: 'text-slate-600' };
  const mini = YEARS.map((y) => ({
    year: y.slice(2), key: y,
    매출: +(annual(y, '매출', clff, region) / 100).toFixed(0),
    영업이익률: marginPct(y, '영업이익', clff, region),
  }));
  return (
    <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center justify-between w-full">
        <span className="text-xs font-semibold text-blue-800">인사이트 {open ? '' : `· ${items.length}건`}</span>
        <span className="text-[11px] text-blue-400">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>
      {open && (
        <div className="mt-2 grid md:grid-cols-[1fr_auto] gap-3 items-center">
          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={i} className="flex gap-1.5 text-[13px] leading-snug">
                <span>{icon[it.kind]}</span><span className={color[it.kind]}>{it.text}</span>
              </div>
            ))}
          </div>
          {/* 참고용 미니 차트: 매출(억원) 막대 — 고정 크기(ResponsiveContainer 0-size 경고 회피) */}
          <div className="md:w-[180px] h-[80px] shrink-0 overflow-hidden">
            <BarChart width={180} height={80} data={mini} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v, n) => n === '매출' ? [`${v.toLocaleString('ko-KR')}억`, '매출'] : v} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Bar dataKey="매출" radius={[3, 3, 0, 0]}>
                {mini.map((b) => <Cell key={b.key} fill={YEAR_COLOR[b.key]} />)}
              </Bar>
            </BarChart>
            <div className="text-[9px] text-slate-400 text-center -mt-1">참고: 매출 추이(억원)</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* 연도 비교 테이블 (행=구분, 열=연도) */
function YearTable({ rows, title, hint, onRow }) {
  const { t: tt } = useLang();
  return (
    <Card title={title} hint={hint}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left font-medium px-3 py-2.5">{tt('항목')}</th>
              {YEARS.map((y) => (
                <th key={y} className={`text-right font-medium px-3 py-2.5 whitespace-nowrap ${y === CURRENT_YEAR ? 'bg-blue-50/50 text-blue-700' : ''}`}>
                  {y.slice(2)}년<span className="block text-[9px] font-normal text-slate-300">{y === CURRENT_YEAR ? '실적+계획' : '실적'}</span>
                </th>
              ))}
              <th className="text-right font-medium px-3 py-2.5">{tt('전년비')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}
                onClick={r.click && onRow ? () => onRow(r.click) : undefined}
                className={`border-b border-slate-50 last:border-0 ${r.click ? 'cursor-pointer hover:bg-blue-50/60' : ''} ${r.bold ? 'bg-slate-50/60' : ''}`}>
                <td className={`text-left px-3 py-2.5 whitespace-nowrap ${r.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                  {tt(r.label)}{r.unit && <span className="text-[10px] text-slate-400 ml-1">{r.unit}</span>}
                  {r.click && <span className="text-[10px] text-blue-400 ml-1">›</span>}
                </td>
                {YEARS.map((y) => {
                  const v = r.cell(y);
                  const neg = typeof v === 'string' && /^-\d/.test(v);
                  return (
                    <td key={y} className={`text-right px-3 py-2.5 tabular-nums
                      ${y === CURRENT_YEAR ? 'font-semibold bg-blue-50/50' : ''}
                      ${neg ? 'text-red-500' : r.pct ? 'text-emerald-600' : y === CURRENT_YEAR ? 'text-slate-800' : 'text-slate-500'}`}>
                      {v}
                    </td>
                  );
                })}
                <td className="text-right px-3 py-2.5 tabular-nums">{r.yoyVal != null ? deltaTag(r.yoyVal) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* 월별 비교 테이블 (행=연도, 열=1~12월 + 연간) */
function MonthTable({ metric, clff, region, subtype }) {
  const { t: tt, lang } = useLang();
  const unit = planUnitLabel(metric);
  const moLabel = (i) => (lang === 'en' ? `${i + 1}` : `${i + 1}월`);
  return (
    <Card title="월별 비교" hint={`${tt(metric)} · ${unit}`}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="text-sm min-w-full">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left font-medium px-2.5 py-2 sticky left-0 bg-white">{tt('연도')}</th>
              {Array.from({ length: 12 }, (_, i) => (
                <th key={i} className="text-right font-medium px-2 py-2 whitespace-nowrap">{moLabel(i)}</th>
              ))}
              <th className="text-right font-medium px-2.5 py-2 whitespace-nowrap bg-slate-50">{tt('연간')}</th>
            </tr>
          </thead>
          <tbody>
            {YEARS.map((y) => {
              const s = series(y, metric, clff, region, subtype);
              const meta = monthsMeta(y);
              const cur = y === CURRENT_YEAR;
              return (
                <tr key={y} className={`border-b border-slate-50 last:border-0 ${cur ? 'bg-blue-50/40' : ''}`}>
                  <td className={`text-left px-2.5 py-2 font-semibold sticky left-0 whitespace-nowrap ${cur ? 'bg-blue-50/40' : 'bg-white'}`} style={{ color: YEAR_COLOR[y] }}>
                    {y.slice(2)}년
                  </td>
                  {s.map((v, i) => {
                    const t = disp(v, metric);
                    const neg = typeof t === 'string' && /^-\d/.test(t);
                    return (
                      <td key={i} className={`text-right px-2 py-2 tabular-nums whitespace-nowrap ${neg ? 'text-red-500' : meta[i].type === '계획' ? 'text-slate-300' : 'text-slate-700'}`}>
                        {t}
                      </td>
                    );
                  })}
                  <td className="text-right px-2.5 py-2 tabular-nums font-bold text-slate-800 bg-slate-100/70">{disp(annual(y, metric, clff, region, subtype), metric)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-slate-400 mt-1.5">연한 글씨 = 계획(미실적) · {CURRENT_YEAR}년 {actualCount(CURRENT_YEAR) + 1}월부터</div>
    </Card>
  );
}

/* ── 월간 비교 (당월 vs 전월 vs 전년동월 + 누계) ──────────── */
const arrSum = (a, n) => (a || []).slice(0, n).reduce((x, v) => x + (v || 0), 0);
const pctOf = (cur, base) => (base ? ((cur - base) / Math.abs(base)) * 100 : null);
const MONTHLY_VIEW_KEY = 'vn_dashboard_monthly_view_v1';
const MONTHLY_VIEW_MODES = ['요약', '점검', '상세'];
const MONTHLY_COMPARE_BASIS = ['mom', 'yoy', 'ytd'];

function loadMonthlyViewState(lastActual) {
  const fallback = {
    month: lastActual,
    viewMode: '요약',
    compareBasis: lastActual > 1 ? 'mom' : 'yoy',
  };
  try {
    const saved = JSON.parse(localStorage.getItem(MONTHLY_VIEW_KEY) || '{}');
    const savedMonth = Number(saved.month);
    const month = Number.isFinite(savedMonth)
      ? Math.min(Math.max(1, savedMonth), lastActual)
      : fallback.month;
    const compareBasis = MONTHLY_COMPARE_BASIS.includes(saved.compareBasis)
      ? (month === 1 && saved.compareBasis === 'mom' ? 'yoy' : saved.compareBasis)
      : fallback.compareBasis;
    return {
      month,
      viewMode: MONTHLY_VIEW_MODES.includes(saved.viewMode) ? saved.viewMode : fallback.viewMode,
      compareBasis,
    };
  } catch {
    return fallback;
  }
}

function MonthlyView({ clff, region, subtype }) {
  const { t, lang } = useLang();
  const meta = monthsMeta(CURRENT_YEAR);
  const lastActual = actualCount(CURRENT_YEAR);
  const [m, setM] = useState(() => loadMonthlyViewState(lastActual).month);          // 선택 월(1~12)
  const [viewMode, setViewMode] = useState(() => loadMonthlyViewState(lastActual).viewMode);
  const [compareBasis, setCompareBasis] = useState(() => loadMonthlyViewState(lastActual).compareBasis);
  const prevYear = YEARS[YEARS.indexOf(CURRENT_YEAR) - 1];
  const type = meta[m - 1].type;                    // 실적 | 계획
  const effectiveBasis = m === 1 && compareBasis === 'mom' ? 'yoy' : compareBasis;

  useEffect(() => {
    localStorage.setItem(MONTHLY_VIEW_KEY, JSON.stringify({ month: m, viewMode, compareBasis: effectiveBasis }));
  }, [m, viewMode, effectiveBasis]);

  const rows = PL_METRICS.map((metric) => {
    const cur = series(CURRENT_YEAR, metric, clff, region, subtype);
    const prv = series(prevYear, metric, clff, region, subtype);
    const cm = cur[m - 1] ?? 0;
    const pm = m >= 2 ? cur[m - 2] : null;          // 전월
    const ym = prv[m - 1];                          // 전년 동월
    const ytdC = arrSum(cur, m), ytdP = arrSum(prv, m);
    const annual = arrSum(cur, 12);
    return {
      metric, cm, pm, ym, annual,
      mom: pm == null ? null : pctOf(cm, pm),
      yoy: pctOf(cm, ym),
      ytdC, ytdP, ytdYoy: pctOf(ytdC, ytdP),
      progress: annual ? (ytdC / annual) * 100 : null,
    };
  });

  const moLabel = (i) => (lang === 'en' ? `${i + 1}` : `${i + 1}월`);
  const viewOptions = [
    { id: '요약', label: lang === 'en' ? 'Summary' : '요약' },
    { id: '점검', label: lang === 'en' ? 'Check' : '점검' },
    { id: '상세', label: lang === 'en' ? 'Detail' : '상세' },
  ];
  const basisOptions = [
    { id: 'mom', label: lang === 'en' ? 'MoM' : '전월비', disabled: m === 1 },
    { id: 'yoy', label: lang === 'en' ? 'YoY month' : '전년동월비' },
    { id: 'ytd', label: lang === 'en' ? 'YTD YoY' : '누계 전년비' },
  ];

  return (
    <>
      {/* 목표 대비 원본은 최신 실적월 자료만 있으므로 해당 월에서만 표시 */}
      {m === lastActual && viewMode === '상세' && (
        <>
          <PlanCard />
          <LineCard metric="매출" />
        </>
      )}

      {/* 월 선택 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-slate-400 mr-1">{lang === 'en' ? 'Month' : '기준 월'}</span>
        {meta.map((mo, i) => (
          <button
            key={i}
            onClick={() => {
              setM(i + 1);
              if (i === 0 && compareBasis === 'mom') setCompareBasis('yoy');
            }}
            disabled={i + 1 > lastActual}
            className={`w-9 py-1 rounded-lg text-xs font-medium transition-colors
              ${m === i + 1 ? 'bg-blue-700 text-white' : mo.type === '실적' ? 'bg-white text-slate-600 border border-slate-200' : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'}`}>
            {moLabel(i)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-blue-900">{lang === 'en' ? 'Monthly workflow' : '북부 월간 업무 보기'}</span>
          <span className="text-[10px] text-blue-500">{lang === 'en' ? 'Show only one comparison detail to reduce repetition.' : '중복을 줄이기 위해 선택한 비교 기준만 펼칩니다.'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-[10px] font-semibold text-slate-500">{lang === 'en' ? 'View' : '보기'}</span>
          {viewOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setViewMode(option.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${viewMode === option.id ? 'border-blue-500 bg-white text-blue-700 shadow-sm' : 'border-blue-100 bg-white/60 text-slate-500'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-14 text-[10px] font-semibold text-slate-500">{lang === 'en' ? 'Compare' : '비교'}</span>
          {basisOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              onClick={() => setCompareBasis(option.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40 ${effectiveBasis === option.id ? 'border-amber-500 bg-white text-amber-700 shadow-sm' : 'border-blue-100 bg-white/60 text-slate-500'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 당월 비교 */}
      <Card title="당월 비교" hint={`${moLabel(m - 1)} · ${t(type)}`}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-100">
                <th className="text-left font-medium px-3 py-2.5">{t('항목')}</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">{t('전년동월')}</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">{t('전월')}</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap bg-blue-50/50 text-blue-700">{t('당월')}</th>
                <th className="text-right font-medium px-3 py-2.5">{t('전월비')}</th>
                <th className="text-right font-medium px-3 py-2.5">{t('전년비')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.metric} className="border-b border-slate-50 last:border-0">
                  <MetricCell metric={r.metric} t={t} />
                  <NumCell v={r.ym} metric={r.metric} />
                  <NumCell v={r.pm} metric={r.metric} />
                  <NumCell v={r.cm} metric={r.metric} bold hl />
                  <PctCell v={r.mom} />
                  <PctCell v={r.yoy} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 선택 기준 변동 원인 분석 */}
      <VarianceCard
        clff={clff}
        region={region}
        subtype={subtype}
        mode={effectiveBasis === 'ytd' ? 'ytd' : 'month'}
        basis={effectiveBasis}
        viewMode={viewMode}
        month={m}
      />

      {/* 누계 비교 */}
      {(effectiveBasis === 'ytd' || viewMode === '상세') && (
      <Card title="누계 비교" hint={`1~${moLabel(m - 1)} · ${t('누계')}`}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-100">
                <th className="text-left font-medium px-3 py-2.5">{t('항목')}</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">{`${prevYear.slice(2)} ${t('누계')}`}</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap bg-blue-50/50 text-blue-700">{`${CURRENT_YEAR.slice(2)} ${t('누계')}`}</th>
                <th className="text-right font-medium px-3 py-2.5">{t('전년비')}</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">{t('연간 전망')}</th>
                <th className="text-right font-medium px-3 py-2.5">{t('진행률')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.metric} className="border-b border-slate-50 last:border-0">
                  <MetricCell metric={r.metric} t={t} />
                  <NumCell v={r.ytdP} metric={r.metric} />
                  <NumCell v={r.ytdC} metric={r.metric} bold hl />
                  <PctCell v={r.ytdYoy} />
                  <NumCell v={r.annual} metric={r.metric} />
                  <td className="text-right px-3 py-2.5 tabular-nums text-slate-500">{r.progress == null ? '-' : `${r.progress.toFixed(0)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      <p className="text-[11px] text-slate-400 text-center">{lang === 'en' ? 'Current month vs prev month / same month last year · YTD vs last year & annual progress' : '당월=전월·전년동월 대비, 누계=전년 대비·연간 전망 진행률 · 단위 매출 억원/이익 백만원'}</p>
    </>
  );
}

/* 한 엔티티(창고/고객) 상세 블록 — 매출/이익/마진 + 상승 원가항목 + 판정 */
function EntityBlock({ e, L, mnD, pp, periodTag }) {
  const exited = e.revPrev > 0 && e.revCur < e.revPrev * 0.05;   // 매출 95%+ 감소 = 이탈/종료
  const entered = e.revPrev < 1 && e.revCur >= 1;                 // 신규 진입
  const check = !exited && e.marginPp != null && e.marginPp <= -1;       // 원가가 매출보다 빠름
  const volume = !exited && !check && e.gpDelta < 0;
  const verdict = exited
    ? { txt: L('매출 이탈/종료', 'churned/ended'), col: 'text-amber-700 font-semibold' }
    : entered
      ? { txt: L('신규', 'new'), col: 'text-slate-500' }
      : e.gpDelta >= 0
        ? { txt: L('개선', 'up'), col: 'text-blue-600' }
        : check
          ? { txt: L('⚠ 점검 필요(원가가 매출보다 빠름)', '⚠ check (cost outpaced sales)'), col: 'text-red-600 font-semibold' }
          : volume
            ? { txt: L('물량 감소 영향(마진 유지)', 'volume-driven (margin held)'), col: 'text-amber-700' }
            : { txt: L('마진 소폭 변동', 'minor'), col: 'text-slate-500' };
  const mTxt = `${e.m0 != null ? e.m0.toFixed(1) : '-'}→${e.m1 != null ? e.m1.toFixed(1) : '-'}%${e.marginPp != null ? `(${pp(e.marginPp)}p)` : ''}`;
  const rise = e.rising.filter((x) => x.delta >= 1).slice(0, 4);
  return (
    <div className={`rounded-md px-2 py-1 ${check ? 'bg-red-50/60' : 'bg-slate-50/70'}`}>
      <div className="text-[12px] leading-snug">
        <b className="text-slate-800">{e.name}</b>
        <span className="ml-1 text-[10px] text-slate-400">· {periodTag}</span>
        {e.turnedLoss ? <span className="text-red-500 text-[10px]">{L(' 적자전환', ' →loss')}</span> : null}{' '}
        <span className="text-slate-500">{L('매출', 'Rev')} {pp(e.revPct)} · {L('이익', 'GP')} {e.gpDelta >= 0 ? '+' : ''}{mnD(e.gpDelta)} · {L('마진', 'mgn')} {mTxt}</span>{' '}
        <span className={verdict.col}>{verdict.txt}</span>
      </div>
      {!exited && rise.length > 0 && (
        <div className="text-[11px] text-slate-500 leading-snug pl-1">
          ↳ {L('상승 원가', 'cost↑')}: {rise.map((x) => {
            const rate = x.ratioDeltaPp != null && isFinite(x.ratioDeltaPp) ? ` · ${L('원가율', 'ratio')} ${x.ratioCur.toFixed(1)}%(${pp(x.ratioDeltaPp)}p)` : '';
            return `${x.item.replace(/^(\d+)\.\s*/, '')} +${mnD(x.delta)}${x.structural ? '🔧' : ''}${x.pct != null && isFinite(x.pct) ? `(${pp(x.pct)})` : ''}${rate}`;
          }).join(', ')}
        </div>
      )}
    </div>
  );
}

/* 한 비교기간(cmp)의 상세 — 창고별·고객별 각각 원가 사유 + 판정 */
function VarianceSection({ tag, color, cmp, clff, region, subtype, viewMode = '상세' }) {
  const { lang } = useLang();
  const L = (ko, en) => (lang === 'en' ? en : ko);
  const biz = subtypeToBiz(subtype);
  // WM→창고, TM→운송만 운영데이터로 정확히 좁혀짐. 그 외 세부(S/P·해상 등)는
  // ops에 대응 세그먼트가 없어 사업 전체 기준으로 넓어짐 — 아래 배지로 명시.
  const bizWidened = subtype !== '전체' && biz === '전체';
  const d = marginDiagnosis(cmp, clff, region, subtype);
  const wh = entityDetails('warehouses', region, clff, biz, cmp);
  const cu = entityDetails('customers', region, clff, biz, cmp);
  const items = costItemCompare(region, clff, biz, cmp);
  const mnD = (v) => Math.round(v).toLocaleString('ko-KR');
  const pp = (v) => (v == null || !isFinite(v) ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
  const pct = (v) => (v == null || !isFinite(v) ? '-' : `${v.toFixed(1)}%`);
  const compress = d.anomaly || (d.marginPp != null && d.marginPp <= -0.5);
  const worst = (a) => a.filter((e) => e.gpDelta < -1).slice(0, 3);   // 악화 Top3
  const whW = worst(wh), cuW = worst(cu);

  return (
    <div className="rounded-lg border border-slate-100 bg-white/70 p-2.5 space-y-1.5">
      <div className={`text-[12px] font-semibold ${color}`}>
        {tag} · {L('매출', 'Rev')} {pp(d.revYoY)} · {L('이익', 'GP')} {pp(d.gpYoY)} · {L('이익률', 'mgn')} {d.m0?.toFixed(1)}→{d.m1?.toFixed(1)}%({pp(d.marginPp)}p){compress ? ' ⚠' : ''}
      </div>
      {bizWidened && (
        <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
          {L(`※ 아래 창고·고객·원가는 세부(${subtype}) 단위 운영데이터가 없어 ${clff === '전체' ? '전체' : clff} 기준입니다`, `※ WH/customer/cost below use ${clff === '전체' ? 'all' : clff}-level ops data (no per-${subtype} breakdown)`)}
        </div>
      )}

      <Suspense fallback={<div className="text-[11px] text-slate-400 px-2 py-1">보고 브리핑 불러오는 중…</div>}>
        <ReportBriefing
          key={[cmp.by, cmp.bm.join('-'), cmp.cy, cmp.cm.join('-'), region, clff, subtype].join(':')}
          tag={tag}
          cmp={cmp}
          clff={clff}
          region={region}
          subtype={subtype}
          viewMode={viewMode}
        />
      </Suspense>

      {/* 창고별 상세 */}
      {viewMode === '상세' && (
      <div className="space-y-1">
        <div className="text-[11px] font-semibold text-slate-500">{L('▌창고별 점검', '▌By warehouse')}</div>
        {whW.length ? whW.map((e) => <EntityBlock key={e.name} e={e} L={L} mnD={mnD} pp={pp} periodTag={tag} />)
          : <div className="text-[11px] text-slate-400 pl-1">{L('이익 악화 창고 없음.', 'No declining warehouse.')}</div>}
      </div>
      )}

      {/* 고객별 상세 */}
      {viewMode === '상세' && (
      <div className="space-y-1">
        <div className="text-[11px] font-semibold text-slate-500">{L('▌고객사별 점검', '▌By customer')}</div>
        {cuW.length ? cuW.map((e) => <EntityBlock key={e.name} e={e} L={L} mnD={mnD} pp={pp} periodTag={tag} />)
          : <div className="text-[11px] text-slate-400 pl-1">{L('이익 악화 고객 없음.', 'No declining customer.')}</div>}
      </div>
      )}

      {/* 전체 원가 합계 비교 */}
      {viewMode === '상세' && items.length > 0 && (
        <table className="w-full text-[11px] mt-0.5">
          <thead>
            <tr className="text-slate-400">
              <th className="text-left font-normal py-0.5">{L('전체 원가 항목', 'Total cost item')} <span className="text-slate-300">{L('백만동', 'Md')}</span></th>
              <th className="text-right font-normal">{L('전기', 'Base')}</th>
              <th className="text-right font-normal">{L('당기', 'Now')}</th>
              <th className="text-right font-normal">Δ</th>
              <th className="text-right font-normal">{L('원가율', 'Ratio')}</th>
              <th className="text-right font-normal">{L('평균差', 'vs Avg')}</th>
              <th className="text-right font-normal">{L('판정', 'Pattern')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.item} className="border-t border-slate-50">
                <td className="text-left text-slate-600 py-0.5 whitespace-nowrap">{it.item}{it.structural && it.delta > 0 ? ' 🔧' : ''}</td>
                <td className="text-right tabular-nums text-slate-400">{mnD(it.prev)}</td>
                <td className="text-right tabular-nums text-slate-700">{mnD(it.cur)}</td>
                <td className={`text-right tabular-nums font-medium ${it.delta > 0 ? 'text-red-500' : 'text-blue-600'}`}>{it.delta >= 0 ? '+' : ''}{mnD(it.delta)}</td>
                <td className={`text-right tabular-nums ${it.ratioDeltaPp > 0 ? 'text-red-500' : it.ratioDeltaPp < 0 ? 'text-blue-500' : 'text-slate-400'}`}>{pct(it.ratioCur)}</td>
                <td className={`text-right tabular-nums ${it.avgDeltaPp > 0 ? 'text-red-500' : it.avgDeltaPp < 0 ? 'text-blue-500' : 'text-slate-400'}`}>{pp(it.avgDeltaPp)}p</td>
                <td className={`text-right whitespace-nowrap ${it.ratioOutlier ? 'text-red-600 font-medium' : it.delta <= 0 ? 'text-blue-500' : it.structural ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
                  {it.ratioOutlier
                    ? L('원가율 이탈', 'Ratio gap')
                    : it.delta <= 0
                      ? L('감소', 'Down')
                      : it.structural
                        ? L('반복↑', 'Repeated↑')
                        : L('확인 필요', 'Check')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* 변동 원인 상세 — 전월비/전년비 섹션으로 창고·고객·원가 사유 전개. mode: 'ytd'|'month' */
function VarianceCard({ clff, region, subtype, mode = 'ytd', basis = 'mom', viewMode = '상세', month = actualCount(CURRENT_YEAR) }) {
  const { lang } = useLang();
  const L = (ko, en) => (lang === 'en' ? en : ko);
  const monthCmp = cmpMoM(month);
  const primaryCmp = mode === 'month' ? (monthCmp || cmpYoYMonth(month)) : cmpYTD(month);
  const overall = marginDiagnosis(primaryCmp, clff, region, subtype);
  if (overall.revYoY == null || overall.gpYoY == null) return null;
  const anyAnom = overall.anomaly || (overall.marginPp != null && overall.marginPp <= -0.5);

  const regLab = region === '전체' ? L('베트남 전체', 'Vietnam') : region;
  const scope = [regLab, clff !== '전체' && clff, subtype !== '전체' && subtype].filter(Boolean).join(' · ');
  const title = `${L('변동 원인 상세', 'Variance detail')} · ${scope}`;
  const sections = mode === 'month'
    ? (basis === 'mom' && monthCmp ? [{
          tag: L(`전월비 ${month - 1}→${month}월`, `MoM ${month - 1}→${month}M`),
          color: 'text-amber-800',
          cmp: monthCmp,
        }] : [{
          tag: month === 1
            ? L('1월 전년동월비 · 1월 누계 동일', 'January YoY · same as January YTD')
            : L(`전년동월비 ${month}월`, `YoY ${month}M`),
          color: 'text-indigo-700',
          cmp: cmpYoYMonth(month),
        }])
    : [{
        tag: L(`1~${month}월 누계 전년비`, `YTD through ${month}M YoY`),
        color: 'text-amber-800',
        cmp: cmpYTD(month),
      }];

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${anyAnom ? 'bg-amber-50/70 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
      <div className={`text-xs font-semibold ${anyAnom ? 'text-amber-800' : 'text-slate-600'}`}>{anyAnom ? '⚠️' : '🔎'} {title}</div>
      {sections.map((s) => (
        <VarianceSection
          key={[s.cmp.by, s.cmp.bm.join('-'), s.cmp.cy, s.cmp.cm.join('-')].join(':')}
          tag={s.tag}
          color={s.color}
          cmp={s.cmp}
          clff={clff}
          region={region}
          subtype={subtype}
          viewMode={viewMode}
        />
      ))}
      {viewMode === '상세' && (
        <div className="text-[10px] text-slate-400">{L('※ 매출·이익률=경영계획(원). 창고·고객·원가항목=운영데이터(백만동). ▼악화/▲개선=매출이익 증감. 🔧=구조적(여러 달 지속). 교차확인 권장.', '※ Rev/margin: KRW (P&L). WH/cust/cost: ops (M dong). ▼down/▲up = gross-profit Δ. 🔧 = structural. Cross-check advised.')}</div>
      )}
    </div>
  );
}

/* 목표 대비(계획比) 카드 — 1.2 탭(당월/누계 계획·실적·전년) 기반 */
function PlanCard() {
  const { t, lang } = useLang();
  const attCol = (p) => (p == null ? 'text-slate-400' : p >= 100 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold');
  const attTxt = (p) => (p == null ? '-' : `${p.toFixed(1)}%`);
  const periods = (d) => [
    { lab: `${t('당월')} ${CMP_MONTH}`, c: d.total.thisMonth, py: d.total.thisMonth.py },
    { lab: `${t('누계')} ~${CMP_MONTH}`, c: d.total.ytd, py: d.total.ytd.py },
  ];
  return (
    <Card title={lang === 'en' ? 'vs Plan (Target)' : '목표 대비 (계획比)'}
      hint={lang === 'en' ? `Vietnam total · base ${CMP_MONTH}` : `베트남 전체 · ${CMP_MONTH} 기준`}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left font-medium px-3 py-2">{t('항목')}</th>
              <th className="text-left font-medium px-2 py-2">{t('구분')}</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap bg-blue-50/50 text-blue-700">{t('실적')}</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{t('계획')}</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{t('달성률')}</th>
              <th className="text-right font-medium px-3 py-2">{t('전년비')}</th>
            </tr>
          </thead>
          <tbody>
            {CMP_METRICS.map((metric) => {
              const d = CMP.metrics[metric];
              return periods(d).map((p, idx) => (
                <tr key={metric + idx} className={`border-b border-slate-50 last:border-0 ${idx === 0 ? '' : 'text-slate-500'}`}>
                  <td className="text-left px-3 py-2 whitespace-nowrap">
                    {idx === 0 ? <span className="font-semibold text-slate-800">{t(metric)}<span className="text-[10px] text-slate-400 ml-1">{planUnitLabel(metric)}</span></span> : ''}
                  </td>
                  <td className="text-left px-2 py-2 text-xs text-slate-500 whitespace-nowrap">{p.lab}</td>
                  <td className="text-right px-3 py-2 tabular-nums font-semibold text-slate-800 bg-blue-50/50">{disp(p.c.act, metric)}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-slate-500">{disp(p.c.plan, metric)}</td>
                  <td className={`text-right px-3 py-2 tabular-nums ${attCol(attain(p.c.act, p.c.plan))}`}>{attTxt(attain(p.c.act, p.c.plan))}</td>
                  <td className={`text-right px-3 py-2 tabular-nums ${deltaColor(ratio(p.c.act, p.py))}`}>{ratio(p.c.act, p.py) == null ? '-' : `${ratio(p.c.act, p.py) >= 0 ? '▲' : '▼'}${Math.abs(ratio(p.c.act, p.py)).toFixed(0)}%`}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-slate-400 mt-1.5">{lang === 'en' ? 'Attainment = Actual / Plan. Green ≥100% (on/above target), red <100%.' : '달성률 = 실적/계획. 초록 ≥100%(목표 달성), 빨강 <100%(미달). 사업라인별 달성률은 아래 표 참고.'}</div>
    </Card>
  );
}

/* 사업 라인별 달성률 (당월/누계) */
function LineCard({ metric }) {
  const { t, lang } = useLang();
  const d = CMP.metrics[metric];
  if (!d?.lines?.length) return null;
  const attCol = (p) => (p == null ? 'text-slate-400' : p >= 100 ? 'text-emerald-600' : 'text-red-500');
  const att = (c) => attain(c.act, c.plan);
  return (
    <Card title={lang === 'en' ? `${t(metric)} by Business Line` : `${t(metric)} 사업라인별 달성률`}
      hint={`${CMP_MONTH} · ${planUnitLabel(metric)}`}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left font-medium px-3 py-2">{lang === 'en' ? 'Line' : '사업라인'}</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{t('당월')} {t('실적')}</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{t('당월')} {t('달성률')}</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{t('누계')} {t('실적')}</th>
              <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{t('누계')} {t('달성률')}</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((ln) => (
              <tr key={ln.name} className="border-b border-slate-50 last:border-0">
                <td className="text-left px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{ln.name}</td>
                <td className="text-right px-3 py-2 tabular-nums text-slate-800">{disp(ln.thisMonth.act, metric)}</td>
                <td className={`text-right px-3 py-2 tabular-nums font-semibold ${attCol(att(ln.thisMonth))}`}>{att(ln.thisMonth) == null ? '-' : `${att(ln.thisMonth).toFixed(0)}%`}</td>
                <td className="text-right px-3 py-2 tabular-nums text-slate-500">{disp(ln.ytd.act, metric)}</td>
                <td className={`text-right px-3 py-2 tabular-nums font-semibold ${attCol(att(ln.ytd))}`}>{att(ln.ytd) == null ? '-' : `${att(ln.ytd).toFixed(0)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-slate-400 mt-1.5">{lang === 'en' ? '※ Management groupings — may overlap; sum ≠ total.' : '※ 사업라인은 관리 기준 그룹(중복 가능) — 합계는 총계와 다를 수 있음. 라인별 달성률만 참고.'}</div>
    </Card>
  );
}

function MetricCell({ metric, t }) {
  return (
    <td className="text-left px-3 py-2.5 whitespace-nowrap font-medium text-slate-700">
      {t(metric)}<span className="text-[10px] text-slate-400 ml-1">{planUnitLabel(metric)}</span>
    </td>
  );
}
function NumCell({ v, metric, bold, hl }) {
  const s = disp(v, metric);
  const neg = typeof s === 'string' && /^-\d/.test(s);
  return <td className={`text-right px-3 py-2.5 tabular-nums ${hl ? 'bg-blue-50/50' : ''} ${neg ? 'text-red-500' : bold ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{v == null ? '-' : s}</td>;
}
function PctCell({ v }) {
  return <td className={`text-right px-3 py-2.5 tabular-nums ${deltaColor(v)}`}>{v == null ? '-' : `${v >= 0 ? '▲' : '▼'}${Math.abs(v).toFixed(1)}%`}</td>;
}

/* ── 요약 ─────────────────────────────────────────────────── */
function SummaryView({ clff, region, subtype }) {
  const rows = PL_METRICS.map((m) => ({
    label: m, unit: planUnitLabel(m), bold: m === '매출' || m === '영업이익',
    cell: (y) => disp(annual(y, m, clff, region, subtype), m),
    yoyVal: yoy(CURRENT_YEAR, m, clff, region, subtype),
  }));
  rows.push({
    label: '영업이익률', unit: '%', pct: true,
    cell: (y) => fmtPct(marginPct(y, '영업이익', clff, region, subtype)),
    yoyVal: null,
  });

  return (
    <>
      <YearTable rows={rows} metric="매출" title="손익 비교 (연도별)" hint="손익항목 × 연도" />
      <MonthTable metric="매출" clff={clff} region={region} subtype={subtype} />
    </>
  );
}

/* ── 단일 지표 ────────────────────────────────────────────── */
function MetricView({ metric, clff, region, subtype, onRow }) {
  const cur = CURRENT_YEAR;
  const unit = planUnitLabel(metric);
  const isProfit = metric !== '매출';

  // 연도별 비교 행: 현재 필터의 '다음 단계' 분해
  let rows;
  if (subtype !== '전체') {
    // 세부 선택 → 지역별
    const regs = region === '전체' ? ['남부', '북부', '기타'] : [region];
    rows = regs.map((rg) => mkRow(metric, rg, clff, rg, subtype, region === '전체' ? { setRegion: rg } : null));
  } else if (clff !== '전체') {
    // 사업 선택 → 세부별
    rows = subtypeList(clff).map((st) => mkRow(metric, st, clff, region, st, { setSub: st }));
  } else {
    // 전체 → CL/FF
    rows = ['CL', 'FF'].map((c) => mkRow(metric, c, c, region, '전체', { setClff: c }));
  }
  // 합계
  rows.push({
    label: '합계', bold: true,
    cell: (y) => disp(annual(y, metric, clff, region, subtype), metric),
    yoyVal: yoy(cur, metric, clff, region, subtype),
  });

  return (
    <>
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Kpi label={`${cur}년 연간`} value={disp(annual(cur, metric, clff, region, subtype), metric)} unit={unit} accent="blue" />
        <Kpi label={`YTD (~${actualCount(cur)}월)`} value={disp(ytd(cur, metric, clff, region, subtype), metric)} unit={unit} accent="slate" />
        <Kpi label="전년비" valueNode={deltaTag(yoy(cur, metric, clff, region, subtype))} accent="slate" />
        <Kpi label={isProfit ? (RATIO_LABEL[metric] || '이익률') : `${YEARS[0].slice(2)}→${cur.slice(2)} 성장`}
          valueNode={isProfit ? <span className="text-emerald-600">{fmtPct(marginPct(cur, metric, clff, region, subtype))}</span> : deltaTag(totalGrowth(metric, clff, region, subtype))}
          accent={isProfit ? 'green' : 'slate'} />
      </div>

      <YearTable rows={rows} metric={metric} title="연도별 비교"
        hint={clff === '전체' ? '사업(CL/FF)별' : subtype !== '전체' ? '지역별' : '세부별'}
        onRow={onRow} />
      <MonthTable metric={metric} clff={clff} region={region} subtype={subtype} />
    </>
  );
}

function mkRow(metric, label, clff_f, region_f, subtype_f, click) {
  return {
    label, click,
    cell: (y) => disp(annual(y, metric, clff_f, region_f, subtype_f), metric),
    yoyVal: yoy(CURRENT_YEAR, metric, clff_f, region_f, subtype_f),
  };
}
const totalGrowth = (metric, clff, region, subtype) => {
  const a = annual(YEARS[0], metric, clff, region, subtype);
  const b = annual(CURRENT_YEAR, metric, clff, region, subtype);
  return a ? ((b - a) / Math.abs(a)) * 100 : null;
};

/* ── 공용 ─────────────────────────────────────────────────── */
function Card({ title, hint, children }) {
  const { t } = useLang();
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{t(title)}</span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Kpi({ label, value, unit, valueNode, accent = 'blue' }) {
  const accents = { blue: 'text-blue-700', green: 'text-emerald-600', slate: 'text-slate-700' };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3.5">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${accents[accent]}`}>
        {valueNode != null ? valueNode : value}
        {unit && <span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
