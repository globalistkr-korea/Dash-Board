import { useEffect, useMemo, useState } from 'react';
import {
  entityDetails, marginDiagnosis, costItemCompare, costItemContributors,
  costDataQualityAlerts, costRatioOutliers, subtypeToBiz, costItemThresholdPp,
} from '../lib/variance';
import { useLang } from '../context/LangContext';

const NOTE_PREFIX = 'vn_dashboard_report_notes_v1:';
const SETTINGS_KEY = 'vn_dashboard_report_ratio_settings_v1';
const cleanItem = (item) => item.replace(/^(\d+)\.\s*/, '');
const signed = (value, digits = 1) => (
  value == null || !Number.isFinite(value)
    ? '-'
    : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
);
const money = (value) => Math.round(value || 0).toLocaleString('ko-KR');
const pp = (value, digits = 1) => (
  value == null || !Number.isFinite(value)
    ? '-'
    : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%p`
);
const ratio = (value) => (
  value == null || !Number.isFinite(value)
    ? '-'
    : `${value.toFixed(1)}%`
);
const THRESHOLDS = ['item', 3, 5, 10];
const baselineOptions = (throughMonth, L) => [
  { value: 'curYtd', label: L(`26년 1~${throughMonth}월 평균`, `2026 Jan-${throughMonth}M avg`) },
  { value: 'prevSame', label: L('25년 동일기간 평균', '2025 same-period avg') },
  { value: 'recent3', label: L('최근 3개월 평균', 'Recent 3M avg') },
  { value: 'recent5', label: L('최근 5개월 평균', 'Recent 5M avg') },
];
const baselineLabel = (basis, throughMonth, L) => (
  baselineOptions(throughMonth, L).find((option) => option.value === basis)?.label
  || baselineOptions(throughMonth, L)[0].label
);
const thresholdLabel = (value, L) => (
  value === 'item' ? L('항목별 기준', 'By item') : `±${value}%p`
);
const contributionText = (rows, L, direction = 'increase') => rows.map((row) => {
  const shareLabel = direction === 'increase' ? L('증가 대상 내', 'share among increases') : L('감소 대상 내', 'share among decreases');
  const share = row.share != null ? `, ${shareLabel} ${row.share.toFixed(0)}%` : '';
  const rate = row.ratioDeltaPp != null ? `, ${L('원가율', 'cost ratio')} ${ratio(row.ratioPrev)}→${ratio(row.ratioCur)}(${pp(row.ratioDeltaPp)})` : '';
  return `${row.name} ${row.delta >= 0 ? '+' : ''}${money(row.delta)}${L('백만동', ' M dong')} (${money(row.prev)}→${money(row.cur)}${rate})${share}`;
}).join(' · ');

const contributorVerdict = (row, L, thresholdPp = 5) => {
  const ratioGap = row.ratioDeltaPp;
  if (ratioGap != null && Number.isFinite(ratioGap) && ratioGap >= thresholdPp) {
    return {
      id: 'ratioUp',
      label: L('원가율↑ 확인', 'Ratio↑ check'),
      className: 'bg-rose-100 text-rose-700',
    };
  }
  if (ratioGap != null && Number.isFinite(ratioGap) && ratioGap <= -thresholdPp) {
    return {
      id: 'ratioDown',
      label: L('원가율↓ 확인', 'Ratio↓ check'),
      className: 'bg-blue-100 text-blue-700',
    };
  }
  if (row.share != null && row.share >= 50) {
    return {
      id: 'highShare',
      label: L('기여도 큼', 'High share'),
      className: 'bg-amber-100 text-amber-700',
    };
  }
  return {
    id: 'note',
    label: L('참고', 'Note'),
    className: 'bg-slate-100 text-slate-600',
  };
};

function ContributorTable({
  title,
  rows = [],
  tone = 'blue',
  L,
  verdictThreshold = 5,
  onCopyRow,
  copiedRowId,
  copyKind,
  copyScope,
}) {
  const [sortBy, setSortBy] = useState('share');
  const [flagFilter, setFlagFilter] = useState('all');
  const toneClass = tone === 'violet'
    ? { wrap: 'bg-violet-50/80 text-violet-950', head: 'text-violet-500', name: 'text-violet-900', active: 'border-violet-300 bg-white text-violet-700' }
    : { wrap: 'bg-blue-50/80 text-blue-950', head: 'text-blue-500', name: 'text-blue-900', active: 'border-blue-300 bg-white text-blue-700' };
  const sortedRows = useMemo(() => {
    const valueOf = (row) => {
      if (sortBy === 'delta') return Math.abs(row.delta || 0);
      if (sortBy === 'ratio') return Math.abs(row.ratioDeltaPp || 0);
      return row.share ?? 0;
    };
    return rows
      .map((row) => ({ ...row, verdict: contributorVerdict(row, L, verdictThreshold) }))
      .filter((row) => flagFilter === 'all' || row.verdict.id === flagFilter)
      .sort((a, b) => valueOf(b) - valueOf(a));
  }, [rows, sortBy, flagFilter, L, verdictThreshold]);
  const sortOptions = [
    { id: 'share', label: L('기여도순', 'Share') },
    { id: 'delta', label: L('증감액순', 'Amount') },
    { id: 'ratio', label: L('원가율순', 'Ratio') },
  ];
  const flagOptions = [
    { id: 'all', label: L('전체', 'All'), count: rows.length },
    { id: 'ratioUp', label: L('원가율↑', 'Ratio↑'), count: rows.filter((row) => contributorVerdict(row, L, verdictThreshold).id === 'ratioUp').length },
    { id: 'ratioDown', label: L('원가율↓', 'Ratio↓'), count: rows.filter((row) => contributorVerdict(row, L, verdictThreshold).id === 'ratioDown').length },
    { id: 'highShare', label: L('기여도 큼', 'High share'), count: rows.filter((row) => contributorVerdict(row, L, verdictThreshold).id === 'highShare').length },
  ];
  if (!rows.length) return null;

  return (
    <div className={`mt-1 rounded ${toneClass.wrap} p-2`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <div className="text-[11px] font-bold">{title}</div>
        <span className="rounded-full bg-white/50 px-1.5 py-0.5 text-[10px] text-slate-500">
          {L('판정 기준', 'Flag threshold')} ±{verdictThreshold}%p
        </span>
        {tone === 'violet' && (
          <div className="group relative">
            <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600">?</span>
            <div className="pointer-events-none absolute left-0 top-5 z-10 hidden w-64 rounded-md border border-violet-100 bg-white p-2 text-[10px] leading-relaxed text-slate-600 shadow-lg group-hover:block">
              {L(
                '고객사 원가는 운영 배부 기준 참고치입니다. 창고·항목별 실제 원가 합계와 다를 수 있어, 보고 전 담당자 확인값을 우선 적용하세요.',
                'Customer costs are allocation-based reference figures. They may differ from actual warehouse/item totals, so use confirmed owner input for reporting.',
              )}
            </div>
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-1">
          {sortOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSortBy(option.id)}
              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${sortBy === option.id ? toneClass.active : 'border-white/80 bg-white/40 text-slate-500'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-1 flex flex-wrap gap-1">
        {flagOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFlagFilter(option.id)}
            disabled={option.count === 0 && option.id !== 'all'}
            className={`rounded-full border px-1.5 py-0.5 text-[10px] ${flagFilter === option.id ? toneClass.active : 'border-white/80 bg-white/40 text-slate-500'} disabled:opacity-40`}
          >
            {option.label} {option.count}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[11px]">
          <thead>
            <tr className={`border-b border-white/70 ${toneClass.head}`}>
              <th className="py-1 pr-2 text-left font-medium">{L('대상', 'Target')}</th>
              <th className="py-1 px-2 text-left font-medium">{L('판정', 'Flag')}</th>
              <th className="py-1 px-2 text-right font-medium">{L('증감액', 'Δ')}</th>
              <th className="py-1 px-2 text-right font-medium">{L('전기→당기', 'Base→Now')}</th>
              <th className="py-1 px-2 text-right font-medium">{L('원가율', 'Ratio')}</th>
              <th className="py-1 pl-2 text-right font-medium">{L('기여도', 'Share')}</th>
              <th className="py-1 pl-2 text-right font-medium">{L('질문', 'Question')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const verdict = row.verdict;
              const rowCopyId = `${copyScope}:${copyKind}:${row.name}`;
              return (
                <tr key={row.name} className="border-b border-white/50 last:border-0">
                  <td className={`py-1 pr-2 font-semibold ${toneClass.name}`}>{row.name}</td>
                  <td className="py-1 px-2">
                    <span className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${verdict.className}`}>
                      {verdict.label}
                    </span>
                  </td>
                  <td className={`py-1 px-2 text-right tabular-nums font-semibold ${row.delta >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {row.delta >= 0 ? '+' : ''}{money(row.delta)}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-600">
                    {money(row.prev)}→{money(row.cur)}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-600">
                    {row.ratioDeltaPp != null
                      ? `${ratio(row.ratioPrev)}→${ratio(row.ratioCur)} (${pp(row.ratioDeltaPp)})`
                      : '-'}
                  </td>
                  <td className="py-1 pl-2 text-right tabular-nums font-semibold text-slate-700">
                    {row.share != null ? `${row.share.toFixed(0)}%` : '-'}
                  </td>
                  <td className="py-1 pl-2 text-right">
                    {onCopyRow && (
                      <button
                        type="button"
                        onClick={() => onCopyRow(row, verdict, copyKind, copyScope)}
                        className="whitespace-nowrap rounded-full border border-white/80 bg-white/60 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-blue-300 hover:text-blue-600"
                      >
                        {copiedRowId === rowCopyId ? L('복사됨', 'Copied') : copiedRowId === `fail:${rowCopyId}` ? L('실패', 'Fail') : L('행 질문 복사', 'Copy row')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-2 text-center text-[11px] text-slate-400">
                  {L('선택한 판정에 해당하는 대상이 없습니다.', 'No targets match the selected flag.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // iOS PWA 등에서 Clipboard API가 실패할 수 있어 textarea 폴백을 사용한다.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

function MiniRatioChart({ rows = [], baseline, thresholdPp, item, L }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const values = rows.map((row) => row.ratio).filter((value) => value != null && Number.isFinite(value));
  if (values.length === 0 || baseline == null || !Number.isFinite(baseline)) return null;
  const minValue = Math.min(...values, baseline - thresholdPp);
  const maxValue = Math.max(...values, baseline + thresholdPp);
  const pad = Math.max((maxValue - minValue) * 0.15, 1);
  const min = minValue - pad;
  const max = maxValue + pad;
  const x = (index) => rows.length <= 1 ? 8 : 8 + (index * 104) / (rows.length - 1);
  const y = (value) => 44 - ((value - min) / (max - min || 1)) * 32;
  const points = rows
    .map((row, index) => (row.ratio == null || !Number.isFinite(row.ratio) ? null : `${x(index)},${y(row.ratio)}`))
    .filter(Boolean)
    .join(' ');
  const baselineY = y(baseline);
  const upperY = y(baseline + thresholdPp);
  const lowerY = y(baseline - thresholdPp);
  const last = rows[rows.length - 1];

  return (
    <div className="mt-1.5 rounded-md bg-slate-50 px-2 py-1.5">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>{L('최근 원가율 추이', 'Recent cost-ratio trend')}</span>
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:border-orange-300 hover:text-orange-600"
        >
          {L('월별 상세 보기', 'Monthly detail')}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="mt-1 flex w-full items-end gap-2 text-left"
      >
        <svg viewBox="0 0 120 52" className="h-12 flex-1" aria-label={L('최근 원가율 미니 차트', 'Recent cost-ratio mini chart')}>
          <line x1="6" x2="114" y1={upperY} y2={upperY} stroke="#fecaca" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="6" x2="114" y1={baselineY} y2={baselineY} stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="4 3" />
          <line x1="6" x2="114" y1={lowerY} y2={lowerY} stroke="#bfdbfe" strokeWidth="1" strokeDasharray="3 3" />
          <polyline points={points} fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          {rows.map((row, index) => (
            row.ratio == null || !Number.isFinite(row.ratio) ? null : (
              <circle key={row.month} cx={x(index)} cy={y(row.ratio)} r="2.3" fill="#f97316" />
            )
          ))}
        </svg>
        <div className="min-w-[64px] text-right text-[10px] text-slate-500">
          <div className="font-semibold text-slate-700">{last ? `${last.month}월 ${ratio(last.ratio)}` : '-'}</div>
          <div>{L('상한', 'upper')} {ratio(baseline + thresholdPp)}</div>
          <div>{L('하한', 'lower')} {ratio(baseline - thresholdPp)}</div>
        </div>
      </button>
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 p-3 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-slate-800">{cleanItem(item)} {L('월별 원가율 상세', 'monthly cost-ratio detail')}</div>
                <div className="text-[11px] text-slate-500">
                  {L('기준', 'base')} {ratio(baseline)} · {L('임계값', 'threshold')} ±{thresholdPp}%p
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
              >
                {L('닫기', 'Close')}
              </button>
            </div>
            <div className="overflow-auto p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="py-1 text-left font-medium">{L('월', 'Month')}</th>
                    <th className="py-1 text-right font-medium">{L('매출', 'Revenue')}</th>
                    <th className="py-1 text-right font-medium">{L('원가', 'Cost')}</th>
                    <th className="py-1 text-right font-medium">{L('원가율', 'Ratio')}</th>
                    <th className="py-1 text-right font-medium">{L('기준差', 'vs Base')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const gap = row.ratio != null ? row.ratio - baseline : null;
                    return (
                      <tr key={row.month} className="border-b border-slate-50">
                        <td className="py-1 text-slate-600">{row.month}{L('월', 'M')}</td>
                        <td className="py-1 text-right tabular-nums text-slate-500">{money(row.revenue)}</td>
                        <td className="py-1 text-right tabular-nums text-slate-700">{money(row.cost)}</td>
                        <td className="py-1 text-right tabular-nums font-semibold text-slate-700">{ratio(row.ratio)}</td>
                        <td className={`py-1 text-right tabular-nums ${gap == null ? 'text-slate-400' : Math.abs(gap) >= thresholdPp ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                          {pp(gap)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                {L('※ 금액은 운영 데이터 기준 백만동입니다. 원가율은 원가÷매출로 계산됩니다.', '※ Amounts are ops data in M dong. Cost ratio = cost ÷ revenue.')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function dropType(item, L) {
  if (item.cur === 0 && item.prev >= 100) return L('0원 전환·누락 의심', 'Zero value / possible omission');
  const ratio = item.prev ? item.cur / item.prev : null;
  if (ratio != null && ratio >= 0.07 && ratio <= 0.13) return L('약 1/10 자릿수 의심', 'Possible 10× digit error');
  return L('급감·입력값 확인', 'Sharp drop / verify input');
}

function alertType(alert, L) {
  if (alert.type === 'zero') return L('0원 전환·누락 의심', 'Zero value / possible omission');
  if (alert.type === 'digit') return L('약 1/10 자릿수 의심', 'Possible 10× digit error');
  return L('70% 이상 급감', 'Drop of 70% or more');
}

function checkPriority(item, L) {
  if (item.urgent && item.id.startsWith('data:')) {
    return {
      score: 100,
      label: L('입력값 우선 점검', 'Input check first'),
      className: 'bg-rose-100 text-rose-700',
    };
  }
  if (item.urgent && item.id.startsWith('drop:')) {
    return {
      score: 90,
      label: L('급감·누락 확인', 'Drop/omission check'),
      className: 'bg-rose-100 text-rose-700',
    };
  }
  if (item.id.startsWith('rate:')) {
    return {
      score: 80,
      label: L('원가율 이탈', 'Ratio deviation'),
      className: 'bg-amber-100 text-amber-700',
    };
  }
  if (item.id.startsWith('cost:')) {
    return {
      score: 70,
      label: L('금액 영향 큼', 'Large amount impact'),
      className: 'bg-blue-100 text-blue-700',
    };
  }
  return {
    score: 50,
    label: L('이익 영향 확인', 'Profit impact check'),
    className: 'bg-slate-100 text-slate-600',
  };
}

function loadNotes(key) {
  try {
    return JSON.parse(localStorage.getItem(NOTE_PREFIX + key) || '{}');
  } catch {
    return {};
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      baseline: ['curYtd', 'prevSame', 'recent3', 'recent5'].includes(saved.baseline) ? saved.baseline : 'curYtd',
      thresholdPp: saved.thresholdPp === 'item' || [3, 5, 10].includes(saved.thresholdPp) ? saved.thresholdPp : 'item',
      itemThresholds: saved.itemThresholds && typeof saved.itemThresholds === 'object' ? saved.itemThresholds : {},
    };
  } catch {
    return { baseline: 'curYtd', thresholdPp: 'item', itemThresholds: {} };
  }
}

function reportConclusion(d, L) {
  if (d.marginPp != null && d.marginPp <= -1) {
    return L(
      `매출이익률이 ${Math.abs(d.marginPp).toFixed(1)}%p 하락했습니다. 매출보다 원가 부담이 빠르게 증가한 구간으로 우선 점검이 필요합니다.`,
      `Gross margin fell ${Math.abs(d.marginPp).toFixed(1)}%p. Cost pressure outpaced revenue and needs priority review.`,
    );
  }
  if (d.gpYoY != null && d.gpYoY < 0) {
    return L(
      `매출이익이 ${Math.abs(d.gpYoY).toFixed(1)}% 감소했습니다. 물량 감소와 원가 상승 영향을 구분해 확인해야 합니다.`,
      `Gross profit fell ${Math.abs(d.gpYoY).toFixed(1)}%. Separate volume impact from cost increases.`,
    );
  }
  return L(
    `매출이익은 ${signed(d.gpYoY)} 변동했고 이익률은 ${d.marginPp == null ? '-' : `${d.marginPp >= 0 ? '+' : ''}${d.marginPp.toFixed(1)}%p`} 변동했습니다. 큰 이상 여부와 별개로 주요 원가 항목은 아래에서 확인할 수 있습니다.`,
    `Gross profit changed ${signed(d.gpYoY)} and margin changed ${d.marginPp == null ? '-' : `${d.marginPp >= 0 ? '+' : ''}${d.marginPp.toFixed(1)}pp`}. Review the main cost items below.`,
  );
}

export default function ReportBriefing({ tag, cmp, clff, region, subtype }) {
  const { lang } = useLang();
  const L = (ko, en) => (lang === 'en' ? en : ko);
  const biz = subtypeToBiz(subtype);
  const throughMonth = Math.max(...cmp.cm.map((i) => i + 1));
  const curAvgLabel = L(`26년 1~${throughMonth}월 평균`, `2026 Jan-${throughMonth}M avg`);
  const prevAvgLabel = L(`25년 동일기간 평균`, `2025 same-period avg`);
  const [settings, setSettings] = useState(loadSettings);
  const baseline = settings.baseline;
  const thresholdPp = settings.thresholdPp;
  const itemThresholds = useMemo(() => settings.itemThresholds || {}, [settings.itemThresholds]);
  const selectedBaselineLabel = baselineLabel(baseline, throughMonth, L);
  const diagnosis = useMemo(
    () => marginDiagnosis(cmp, clff, region, subtype),
    [cmp, clff, region, subtype],
  );
  const costs = useMemo(
    () => costItemCompare(region, clff, biz, cmp),
    [region, clff, biz, cmp],
  );
  const warehouses = useMemo(
    () => entityDetails('warehouses', region, clff, biz, cmp),
    [region, clff, biz, cmp],
  );
  const customers = useMemo(
    () => entityDetails('customers', region, clff, biz, cmp),
    [region, clff, biz, cmp],
  );
  const warehouseAlerts = useMemo(
    () => costDataQualityAlerts('warehouses', region, clff, biz, cmp, 4),
    [region, clff, biz, cmp],
  );
  const customerAlerts = useMemo(
    () => costDataQualityAlerts('customers', region, clff, biz, cmp, 3),
    [region, clff, biz, cmp],
  );
  const rateOutliers = useMemo(
    () => costRatioOutliers(region, clff, biz, cmp, 5, { basis: baseline, thresholdPp, thresholdOverrides: itemThresholds }),
    [region, clff, biz, cmp, baseline, thresholdPp, itemThresholds],
  );
  const noteKey = [
    cmp.by, cmp.bm.join('-'), cmp.cy, cmp.cm.join('-'), region, clff, subtype,
  ].join(':');
  const [notes, setNotes] = useState(() => loadNotes(noteKey));
  const [open, setOpen] = useState(true);
  const [checkFilter, setCheckFilter] = useState('all');
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedRowId, setCopiedRowId] = useState(null);
  const [copyMode, setCopyMode] = useState('owner');

  useEffect(() => {
    localStorage.setItem(NOTE_PREFIX + noteKey, JSON.stringify(notes));
  }, [noteKey, notes]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const increases = costs.filter((item) => item.delta > 0);
  const decreases = costs
    .filter((item) => item.delta < 0 && item.prev >= 100 && (item.cur === 0 || item.cur <= item.prev * 0.3))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);
  const totalIncrease = increases.reduce((sum, item) => sum + item.delta, 0);
  const topCosts = increases.slice(0, 3);
  const topRateOutliers = rateOutliers.slice(0, 4);
  const editableCostItems = costs.slice(0, 10).map((item) => {
    const key = cleanItem(item.item);
    return {
      key,
      label: key,
      defaultValue: costItemThresholdPp(item.item),
    };
  });
  const worstWarehouse = warehouses.find((item) => item.gpDelta < -1);
  const worstCustomer = customers.find((item) => item.gpDelta < -1);
  const costChecks = topCosts.map((item) => {
    const warehouseDrivers = costItemContributors('warehouses', item.item, region, clff, biz, cmp);
    const customerDrivers = costItemContributors('customers', item.item, region, clff, biz, cmp);
    const warehouseNames = warehouseDrivers.map((row) => row.name).join(', ');
    const customerNames = customerDrivers.map((row) => row.name).join(', ');
    const target = [
      warehouseNames && L(`창고 ${warehouseNames}`, `warehouses ${warehouseNames}`),
      customerNames && L(`고객사 ${customerNames}`, `customers ${customerNames}`),
    ].filter(Boolean).join(' / ');
    return {
      id: `cost:${item.item}`,
      item: item.item,
      title: L(`${cleanItem(item.item)} 증가 사유`, `${cleanItem(item.item)} increase`),
      evidence: L(
        `${money(item.prev)} → ${money(item.cur)}백만동, ${money(item.delta)}백만동 증가 (${signed(item.pct)}). 매출 대비 원가율은 ${ratio(item.ratioPrev)} → ${ratio(item.ratioCur)}(${pp(item.ratioDeltaPp)})이고, ${curAvgLabel} ${ratio(item.avgRatioCurYtd)} 대비 ${pp(item.avgDeltaPp)}입니다. ${item.structural ? '여러 달 반복되어 구조적 가능성이 있습니다.' : '특정 기간 집중 여부를 확인해야 합니다.'}`,
        `${money(item.prev)} → ${money(item.cur)} M dong, up ${money(item.delta)} (${signed(item.pct)}). Cost ratio moved ${ratio(item.ratioPrev)} → ${ratio(item.ratioCur)}(${pp(item.ratioDeltaPp)}), ${pp(item.avgDeltaPp)} vs the 2026 YTD average ${ratio(item.avgRatioCurYtd)}. ${item.structural ? 'Repeated across months; potentially structural.' : 'Check whether the increase is period-specific.'}`,
      ),
      warehouseDetail: warehouseDrivers.length
        ? contributionText(warehouseDrivers, L)
        : L('증가 창고 특정 불가', 'No warehouse driver identified'),
      customerDetail: customerDrivers.length
        ? contributionText(customerDrivers, L)
        : L('고객사 배부 데이터에서 증가 대상 특정 불가', 'No customer driver identified in allocated data'),
      warehouseRows: warehouseDrivers,
      customerRows: customerDrivers,
      question: L(
        target
          ? `${target} 담당자에게 물량·작업시간·적용 단가가 얼마나 변했는지, 신규 작업·일회성 비용·회계 재분류가 있었는지 확인해 주세요. 특히 매출 대비 원가율이 평균에서 벗어난 이유를 수량 효과와 단가 효과로 나눌 수 있나요?`
          : '물량·작업시간·적용 단가 변화와 신규 작업·일회성 비용·회계 재분류 여부를 확인해 주세요. 특히 매출 대비 원가율이 평균에서 벗어난 이유를 수량 효과와 단가 효과로 나눌 수 있나요?',
        target
          ? `Ask the owners of ${target} about volume, work hours, rates, new work, one-off costs, and reclassification. Can the cost-ratio deviation be split into quantity and rate effects?`
          : 'Check volume, work hours, rates, new work, one-off costs, and reclassification. Can the cost-ratio deviation be split into quantity and rate effects?',
      ),
    };
  });
  const rateChecks = topRateOutliers.map((item) => {
    const direction = (item.avgDeltaPp || 0) >= 0 ? 'increase' : 'decrease';
    const warehouseDrivers = costItemContributors('warehouses', item.item, region, clff, biz, cmp, 3, direction);
    const customerDrivers = costItemContributors('customers', item.item, region, clff, biz, cmp, 3, direction);
    const warehouseNames = warehouseDrivers.map((row) => row.name).join(', ');
    const customerNames = customerDrivers.map((row) => row.name).join(', ');
    const targets = [
      warehouseNames && L(`창고 ${warehouseNames}`, `warehouses ${warehouseNames}`),
      customerNames && L(`고객사 ${customerNames}`, `customers ${customerNames}`),
    ].filter(Boolean).join(' / ');
    return {
      id: `rate:${item.item}`,
      urgent: Math.abs(item.basisDeltaPp || 0) >= item.thresholdPp,
      title: L(`${cleanItem(item.item)} 원가율 이탈`, `${cleanItem(item.item)} cost-ratio deviation`),
      evidence: L(
        `금액은 ${money(item.prev)} → ${money(item.cur)}백만동(${item.delta >= 0 ? '+' : ''}${money(item.delta)})이고, 매출 대비 원가율은 ${ratio(item.ratioCur)}입니다. 선택 기준선 ${selectedBaselineLabel} ${ratio(item.baselineRatio)} 대비 ${pp(item.basisDeltaPp)}로, 임계값 ${item.thresholdPp}%p를 벗어났습니다. 참고로 ${curAvgLabel} 대비 ${pp(item.avgDeltaPp)}, ${prevAvgLabel} 대비 ${pp(item.prevAvgDeltaPp)}입니다.`,
        `Amount moved ${money(item.prev)} → ${money(item.cur)} M dong (${item.delta >= 0 ? '+' : ''}${money(item.delta)}), and the cost ratio is ${ratio(item.ratioCur)}. It is ${pp(item.basisDeltaPp)} vs the selected baseline ${selectedBaselineLabel} ${ratio(item.baselineRatio)}, beyond the ${item.thresholdPp}pp threshold. For reference: ${pp(item.avgDeltaPp)} vs 2026 YTD and ${pp(item.prevAvgDeltaPp)} vs 2025 same-period.`,
      ),
      chartRows: baseline === 'recent3' ? item.ratioTrend3 : item.ratioTrend5,
      baselineRatio: item.baselineRatio,
      thresholdPp: item.thresholdPp,
      item: item.item,
      warehouseDetail: warehouseDrivers.length
        ? contributionText(warehouseDrivers, L, direction)
        : L('원가율 이탈 창고 특정 불가', 'No warehouse ratio driver identified'),
      customerDetail: customerDrivers.length
        ? contributionText(customerDrivers, L, direction)
        : L('고객사 배부 데이터에서 원가율 이탈 대상 특정 불가', 'No customer ratio driver identified in allocated data'),
      warehouseRows: warehouseDrivers,
      customerRows: customerDrivers,
      question: L(
        `${targets || '해당 원가 담당자'}에게 ① 매출 구성/물량 믹스가 바뀌었는지 ② 단가·계약 조건이 바뀌었는지 ③ 고정비가 매출 감소로 희석되지 않았는지 ④ 비용 배부 기준 또는 계정 분류가 바뀌었는지 ⑤ 일회성/누락/이월 비용인지 확인해 주세요.`,
        `Ask ${targets || 'the cost owner'} to verify: ① revenue mix/volume change, ② rate or contract change, ③ fixed-cost absorption due to lower revenue, ④ allocation/account changes, and ⑤ one-off/omitted/deferred cost.`,
      ),
    };
  });
  const dropChecks = decreases.map((item) => {
    const warehouseDrivers = costItemContributors('warehouses', item.item, region, clff, biz, cmp, 3, 'decrease');
    const customerDrivers = costItemContributors('customers', item.item, region, clff, biz, cmp, 3, 'decrease');
    const warehouseNames = warehouseDrivers.map((row) => row.name).join(', ');
    const customerNames = customerDrivers.map((row) => row.name).join(', ');
    const targets = [
      warehouseNames && L(`창고 ${warehouseNames}`, `warehouses ${warehouseNames}`),
      customerNames && L(`고객사 ${customerNames}`, `customers ${customerNames}`),
    ].filter(Boolean).join(' / ');
    return {
      id: `drop:${item.item}`,
      item: item.item,
      urgent: true,
      title: `${cleanItem(item.item)} · ${dropType(item, L)}`,
      evidence: L(
        `${money(item.prev)} → ${money(item.cur)}백만동, ${money(Math.abs(item.delta))}백만동 감소 (${signed(item.pct)}). 실제 절감일 수도 있지만 미기입·자릿수·계정 변경 가능성을 먼저 확인해야 합니다.`,
        `${money(item.prev)} → ${money(item.cur)} M dong, down ${money(Math.abs(item.delta))} (${signed(item.pct)}). This may be a real saving, but first verify omission, digit error, or account change.`,
      ),
      warehouseDetail: warehouseDrivers.length
        ? contributionText(warehouseDrivers, L, 'decrease')
        : L('감소 창고 특정 불가', 'No warehouse drop identified'),
      customerDetail: customerDrivers.length
        ? contributionText(customerDrivers, L, 'decrease')
        : L('고객사 배부 데이터에서 감소 대상 특정 불가', 'No customer drop identified in allocated data'),
      warehouseRows: warehouseDrivers,
      customerRows: customerDrivers,
      question: L(
        `${targets || '해당 원가 담당자'}에게 ① 원본 전표·시트가 실제 ${money(item.cur)}백만동인지 ② 0 또는 소수점·자릿수 오입력인지 ③ 비용 누락·익월 이월인지 ④ 다른 계정으로 재분류됐는지 ⑤ 실제 물량·작업시간 감소인지 확인해 주세요.`,
        `Ask ${targets || 'the cost owner'} to verify: ① source voucher/sheet value ${money(item.cur)} M dong, ② zero/decimal/digit error, ③ omitted or deferred cost, ④ account reclassification, and ⑤ actual volume/work-hour decline.`,
      ),
    };
  });
  const dataChecks = [...warehouseAlerts, ...customerAlerts].map((alert) => {
    const targetType = alert.kind === 'warehouses' ? L('창고', 'Warehouse') : L('고객사', 'Customer');
    return {
      id: `data:${alert.kind}:${alert.entity}:${alert.item}`,
      urgent: true,
      title: `${targetType} ${alert.entity} · ${cleanItem(alert.item)} · ${alertType(alert, L)}`,
      evidence: L(
        `${money(alert.prev)} → ${money(alert.cur)}백만동 (${signed(alert.pct)}). 전체 합계에서 다른 대상의 증가와 상쇄되더라도 개별 입력값은 별도 점검이 필요합니다.`,
        `${money(alert.prev)} → ${money(alert.cur)} M dong (${signed(alert.pct)}). This individual value needs review even if offset by increases elsewhere.`,
      ),
      question: L(
        `${alert.entity} 담당자에게 원본 시트·전표의 ${cleanItem(alert.item)} 값이 실제 ${money(alert.cur)}백만동인지 확인해 주세요. 0/누락, 소수점·자릿수 오류, 익월 이월, 계정 변경, 실제 운영량 감소 중 어느 경우인가요?`,
        `Ask the ${alert.entity} owner to verify whether ${cleanItem(alert.item)} is truly ${money(alert.cur)} M dong. Is it zero/omitted, decimal or digit error, deferred, reclassified, or an actual operational decline?`,
      ),
    };
  });
  const checks = [
    ...rateChecks,
    ...dataChecks,
    ...dropChecks,
    ...costChecks,
    ...(worstWarehouse ? [{
      id: `warehouse:${worstWarehouse.name}`,
      title: L(`${worstWarehouse.name} 이익 악화`, `${worstWarehouse.name} profit decline`),
      evidence: L(
        `매출이익 ${money(worstWarehouse.gpDelta)}백만동 변동, 매출 ${signed(worstWarehouse.revPct)}, 마진 ${worstWarehouse.marginPp == null ? '-' : `${worstWarehouse.marginPp.toFixed(1)}%p`}.`,
        `Gross profit ${money(worstWarehouse.gpDelta)} M dong, revenue ${signed(worstWarehouse.revPct)}, margin ${worstWarehouse.marginPp == null ? '-' : `${worstWarehouse.marginPp.toFixed(1)}pp`}.`,
      ),
      question: L(
        '계약 조건, 운영 차질, 고객 물량 또는 비용 배부 변경이 있었나요?',
        'Any contract, operational, customer-volume, or cost-allocation change?',
      ),
    }] : []),
    ...(worstCustomer ? [{
      id: `customer:${worstCustomer.name}`,
      title: L(`${worstCustomer.name} 고객 영향`, `${worstCustomer.name} customer impact`),
      evidence: L(
        `매출이익 ${money(worstCustomer.gpDelta)}백만동 변동, 매출 ${signed(worstCustomer.revPct)}.`,
        `Gross profit ${money(worstCustomer.gpDelta)} M dong, revenue ${signed(worstCustomer.revPct)}.`,
      ),
      question: L(
        '물량 감소·단가 변경·계약 종료 또는 일회성 이슈가 있었나요?',
        'Any volume decline, price change, contract end, or one-off issue?',
      ),
    }] : []),
  ].slice(0, 10);
  const checkFilterOptions = [
    { id: 'all', label: L('전체 확인', 'All checks'), matcher: () => true },
    { id: 'urgent', label: L('입력 점검', 'Input check'), matcher: (item) => item.urgent },
    { id: 'ratio', label: L('원가율 이탈', 'Ratio gaps'), matcher: (item) => item.id.startsWith('rate:') },
    { id: 'drop', label: L('급감·누락', 'Drops/omissions'), matcher: (item) => item.id.startsWith('drop:') || item.id.startsWith('data:') },
    { id: 'cost', label: L('원가 증가', 'Cost increases'), matcher: (item) => item.id.startsWith('cost:') },
  ].map((filter) => ({
    ...filter,
    count: checks.filter(filter.matcher).length,
  }));
  const activeCheckFilter = checkFilterOptions.find((filter) => filter.id === checkFilter) || checkFilterOptions[0];
  const visibleChecks = checks.filter(activeCheckFilter.matcher);
  const confirmedChecks = checks.filter((item) => notes[item.id]?.trim());
  const visibleConfirmedChecks = visibleChecks.filter((item) => notes[item.id]?.trim());
  const priorityChecks = checks
    .map((item) => ({
      ...item,
      priority: checkPriority(item, L),
      confirmed: Boolean(notes[item.id]?.trim()),
    }))
    .sort((a, b) => {
      if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1;
      return b.priority.score - a.priority.score;
    })
    .slice(0, 5);
  const updateItemThreshold = (key, value) => {
    const parsed = Number(value);
    setSettings((current) => ({
      ...current,
      itemThresholds: {
        ...(current.itemThresholds || {}),
        [key]: Number.isFinite(parsed) && parsed > 0 ? parsed : '',
      },
    }));
  };
  const resetItemThreshold = (key) => {
    setSettings((current) => {
      const next = { ...(current.itemThresholds || {}) };
      delete next[key];
      return { ...current, itemThresholds: next };
    });
  };
  const fallbackVerdictThreshold = (itemName) => {
    if (typeof thresholdPp === 'number') return thresholdPp;
    return costItemThresholdPp(itemName || '');
  };
  const copyQuestion = async (item) => {
    const text = copyMode === 'owner'
      ? [
        `[확인 요청] ${item.title}`,
        item.evidence,
        item.warehouseDetail ? `관련 창고: ${item.warehouseDetail}` : '',
        item.customerDetail ? `관련 고객사: ${item.customerDetail}` : '',
        `확인 부탁드립니다: ${item.question}`,
        '확인 후 실제 사유와 근거 금액/기간을 회신 부탁드립니다.',
      ].filter(Boolean).join('\n')
      : [
        `[${item.title}]`,
        item.evidence,
        item.warehouseDetail ? `어디 창고: ${item.warehouseDetail}` : '',
        item.customerDetail ? `어느 고객사: ${item.customerDetail}` : '',
        `보고 메모: ${item.question}`,
      ].filter(Boolean).join('\n');
    const ok = await copyText(text);
    setCopiedId(ok ? item.id : `fail:${item.id}`);
    window.setTimeout(() => setCopiedId(null), 1800);
  };
  const copyContributorQuestion = async (item, row, verdict, kind, scope) => {
    const kindLabel = kind === 'warehouse' ? L('창고', 'Warehouse') : L('고객사', 'Customer');
    const common = [
      `${kindLabel}: ${row.name}`,
      `${L('판정', 'Flag')}: ${verdict.label}`,
      `${L('증감액', 'Delta')}: ${row.delta >= 0 ? '+' : ''}${money(row.delta)}${L('백만동', ' M dong')} (${money(row.prev)}→${money(row.cur)})`,
      row.ratioDeltaPp != null
        ? `${L('원가율', 'Cost ratio')}: ${ratio(row.ratioPrev)}→${ratio(row.ratioCur)} (${pp(row.ratioDeltaPp)})`
        : '',
      row.share != null ? `${L('기여도', 'Share')}: ${row.share.toFixed(0)}%` : '',
    ].filter(Boolean);
    const text = copyMode === 'owner'
      ? [
        `[확인 요청] ${item.title}`,
        ...common,
        L(
          `${row.name} 담당자님, 실제 물량·작업시간·단가·계약 조건·비용 배부·일회성/누락/이월 비용 중 어떤 요인인지 확인 부탁드립니다. 가능하면 수량 효과와 단가 효과를 나눠서 회신 부탁드립니다.`,
          `Please confirm whether ${row.name}'s change came from actual volume, work hours, rates, contract terms, cost allocation, one-off cost, omission, or deferred cost. If possible, split the reason into quantity effect and rate effect.`,
        ),
      ].join('\n')
      : [
        `[보고용] ${item.title}`,
        ...common,
        L(
          `${row.name}은(는) ${verdict.label} 대상으로, 담당자 확인 후 실제 사유를 보고 메모에 반영합니다.`,
          `${row.name} is flagged as ${verdict.label}; confirmed owner input should be reflected in the report note.`,
        ),
      ].join('\n');
    const rowId = `${scope}:${kind}:${row.name}`;
    const ok = await copyText(text);
    setCopiedRowId(ok ? rowId : `fail:${rowId}`);
    window.setTimeout(() => setCopiedRowId(null), 1800);
  };

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="text-xs font-bold text-blue-900">
          📝 {L('보고용 브리핑', 'Report briefing')} · {tag}
        </span>
        <span className="text-[11px] text-blue-500">
          {open ? L('접기 ▲', 'Close ▲') : L('펼치기 ▼', 'Open ▼')}
        </span>
      </button>

      {open && (
        <div className="border-t border-blue-100 p-3 space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-1">
              {L('1. 보고 결론', '1. Conclusion')}
            </div>
            <p className="text-[13px] leading-relaxed font-medium text-slate-800">
              {reportConclusion(diagnosis, L)}
            </p>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-1">
              {L('2. 앱에서 수치로 확인된 내용', '2. Verified by app data')}
            </div>
            <div className="mb-2 rounded-md border border-blue-100 bg-white/70 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500">{L('원가율 기준선', 'Cost-ratio baseline')}</span>
                {baselineOptions(throughMonth, L).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, baseline: option.value }))}
                    className={`rounded-full px-2 py-0.5 text-[10px] border ${baseline === option.value ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-slate-200 bg-white text-slate-500'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500">{L('이탈 임계값', 'Deviation threshold')}</span>
                {THRESHOLDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, thresholdPp: value }))}
                    className={`rounded-full px-2 py-0.5 text-[10px] border ${thresholdPp === value ? 'border-rose-500 bg-rose-50 text-rose-700 font-semibold' : 'border-slate-200 bg-white text-slate-500'}`}
                  >
                    {thresholdLabel(value, L)}
                  </button>
                ))}
                <span className="text-[10px] text-slate-400">
                  {L('기본은 항목별 기준 · 선택값은 자동 저장됩니다.', 'Default is by item · selection is saved automatically.')}
                </span>
              </div>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => setThresholdOpen((value) => !value)}
                  className="text-[10px] font-semibold text-blue-600"
                >
                  {thresholdOpen ? L('항목별 기준 접기 ▲', 'Hide item thresholds ▲') : L('항목별 기준 편집 ▼', 'Edit item thresholds ▼')}
                </button>
                {thresholdOpen && (
                  <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {editableCostItems.map((item) => (
                      <div key={item.key} className="flex items-center gap-1 rounded bg-slate-50 px-2 py-1">
                        <span className="min-w-0 flex-1 truncate text-[10px] text-slate-600">{item.label}</span>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={itemThresholds[item.key] ?? item.defaultValue}
                          onChange={(event) => updateItemThreshold(item.key, event.target.value)}
                          className="w-14 rounded border border-slate-200 bg-white px-1 py-0.5 text-right text-[11px] tabular-nums text-slate-700"
                          aria-label={`${item.label} threshold`}
                        />
                        <span className="text-[10px] text-slate-400">%p</span>
                        {itemThresholds[item.key] != null && itemThresholds[item.key] !== '' && (
                          <button
                            type="button"
                            onClick={() => resetItemThreshold(item.key)}
                            className="text-[10px] text-slate-400"
                          >
                            {L('기본', 'Reset')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <ul className="space-y-1 text-[12px] leading-relaxed text-slate-700">
              <li>• {L('매출', 'Revenue')} {signed(diagnosis.revYoY)} · {L('매출이익', 'Gross profit')} {signed(diagnosis.gpYoY)} · {L('이익률', 'Margin')} {diagnosis.m0?.toFixed(1) ?? '-'}% → {diagnosis.m1?.toFixed(1) ?? '-'}%</li>
              {topRateOutliers.map((item) => (
                <li key={`rate-${item.item}`}>
                  • <span className="font-semibold text-amber-800">{cleanItem(item.item)} {L('원가율', 'cost ratio')}</span>:
                  {' '}{ratio(item.ratioCur)} · {selectedBaselineLabel} {L('대비', 'vs')} <b className={item.basisDeltaPp >= 0 ? 'text-red-600' : 'text-blue-600'}>{pp(item.basisDeltaPp)}</b>
                  {' · '}{L('금액', 'amount')} {money(item.prev)} → {money(item.cur)} {L('백만동', 'M dong')}
                </li>
              ))}
              {topCosts.map((item) => (
                <li key={item.item}>
                  • {cleanItem(item.item)}: {money(item.prev)} → {money(item.cur)} {L('백만동', 'M dong')}
                  <b className={item.delta > 0 ? 'text-red-600' : 'text-blue-600'}> ({item.delta >= 0 ? '+' : ''}{money(item.delta)}, {signed(item.pct)})</b>
                  {item.ratioCur != null && ` · ${L('원가율', 'cost ratio')} ${ratio(item.ratioCur)} (${L('평균 대비', 'vs avg')} ${pp(item.avgDeltaPp)})`}
                  {totalIncrease > 0 && ` · ${L('전체 증가분 영향', 'share of increase')} ${(item.delta / totalIncrease * 100).toFixed(0)}%`}
                  {item.structural ? ` · ${L('반복 상승', 'repeated rise')} 🔧` : ''}
                </li>
              ))}
              {decreases.map((item) => (
                <li key={`drop-${item.item}`}>
                  • <span className="text-rose-700 font-semibold">⚠ {cleanItem(item.item)} {dropType(item, L)}</span>:
                  {' '}{money(item.prev)} → {money(item.cur)} {L('백만동', 'M dong')}
                  <b className="text-rose-600"> ({money(item.delta)}, {signed(item.pct)})</b>
                </li>
              ))}
              {[...warehouseAlerts, ...customerAlerts].slice(0, 5).map((alert) => (
                <li key={`data-${alert.kind}-${alert.entity}-${alert.item}`}>
                  • <span className="text-rose-700 font-semibold">🚨 {alert.kind === 'warehouses' ? L('창고', 'Warehouse') : L('고객사', 'Customer')} {alert.entity}</span>
                  {' · '}{cleanItem(alert.item)}: {money(alert.prev)} → {money(alert.cur)} {L('백만동', 'M dong')}
                  {' · '}<b className="text-rose-600">{alertType(alert, L)}</b>
                </li>
              ))}
            </ul>
          </div>

          {priorityChecks.length > 0 && (
            <div className="rounded-md border border-amber-100 bg-amber-50/70 p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-amber-800">
                  {L('3. 오늘 우선 확인 TOP 5', '3. Priority check TOP 5')}
                </div>
                <span className="text-[10px] text-amber-600">
                  {L('미확인 우선 · 수치 기반', 'Unconfirmed first · data-based')}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {priorityChecks.map((item, index) => (
                  <div key={`priority-${item.id}`} className="rounded-md border border-white/70 bg-white/70 p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-amber-700">#{index + 1}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${item.priority.className}`}>
                        {item.confirmed ? L('확인 완료', 'Confirmed') : item.priority.label}
                      </span>
                      <b className="min-w-0 flex-1 truncate text-[11px] text-slate-700">{item.title}</b>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                      {item.evidence}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="text-[11px] font-semibold text-slate-500">
                {L('4. 담당자 확인 필요', '4. Needs owner confirmation')}
              </div>
              <span className="text-[10px] text-slate-400">
                {visibleConfirmedChecks.length}/{visibleChecks.length} {L('확인', 'confirmed')}
              </span>
            </div>
            <div className="mb-2 rounded-md border border-slate-100 bg-white/70 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500">{L('복사 문구', 'Copy wording')}</span>
                {[
                  { id: 'owner', label: L('담당자 문의용', 'For owner inquiry') },
                  { id: 'report', label: L('보고용', 'For report') },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setCopyMode(mode.id)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${copyMode === mode.id ? 'border-blue-500 bg-blue-50 font-semibold text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}
                  >
                    {mode.label}
                  </button>
                ))}
                <span className="text-[10px] text-slate-400">
                  {copyMode === 'owner'
                    ? L('담당자에게 바로 보낼 질문 형식입니다.', 'Question wording ready to send to owners.')
                    : L('보고서/발표 메모에 붙이기 좋은 형식입니다.', 'Report/presentation note wording.')}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {L('확인 사유는 현재 조건별로 자동 저장되어 같은 월·지역·구분으로 다시 열면 다시 확인할 수 있습니다.', 'Confirmed reasons are saved by the current period/region/category and can be reviewed again when reopened with the same conditions.')}
              </p>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-1">
              {checkFilterOptions.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setCheckFilter(filter.id)}
                  disabled={filter.count === 0}
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${checkFilter === filter.id ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold' : 'border-slate-200 bg-white text-slate-500'}`}
                >
                  {filter.label} {filter.count}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {visibleChecks.map((item) => {
                const confirmed = Boolean(notes[item.id]?.trim());
                return (
                  <div key={item.id} className={`rounded-md border bg-white p-2 ${item.urgent ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${confirmed ? 'bg-emerald-100 text-emerald-700' : item.urgent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {confirmed ? L('확인 완료', 'Confirmed') : item.urgent ? L('입력 점검', 'Input check') : L('확인 필요', 'Check')}
                      </span>
                      <b className="text-[12px] text-slate-700">{item.title}</b>
                      <button
                        type="button"
                        onClick={() => copyQuestion(item)}
                        className="ml-auto rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 hover:border-blue-300 hover:text-blue-600"
                      >
                        {copiedId === item.id ? L('복사됨', 'Copied') : copiedId === `fail:${item.id}` ? L('복사 실패', 'Copy failed') : L('질문 복사', 'Copy question')}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.evidence}</p>
                    <ContributorTable
                      title={L('어디 창고', 'Warehouses')}
                      rows={item.warehouseRows || []}
                      tone="blue"
                      L={L}
                      verdictThreshold={item.thresholdPp || fallbackVerdictThreshold(item.item)}
                      onCopyRow={(row, verdict, kind, scope) => copyContributorQuestion(item, row, verdict, kind, scope)}
                      copiedRowId={copiedRowId}
                      copyKind="warehouse"
                      copyScope={item.id}
                    />
                    <ContributorTable
                      title={L('어느 고객사', 'Customers')}
                      rows={item.customerRows || []}
                      tone="violet"
                      L={L}
                      verdictThreshold={item.thresholdPp || fallbackVerdictThreshold(item.item)}
                      onCopyRow={(row, verdict, kind, scope) => copyContributorQuestion(item, row, verdict, kind, scope)}
                      copiedRowId={copiedRowId}
                      copyKind="customer"
                      copyScope={item.id}
                    />
                    {item.customerRows?.length > 0 && (
                      <p className="mt-1 text-[10px] text-violet-500">
                        {L('※ 고객사 원가는 운영 배부 기준 참고치이며 창고 합계와 다를 수 있습니다.', '※ Customer costs are allocated operational figures and may differ from warehouse totals.')}
                      </p>
                    )}
                    {item.chartRows && (
                      <MiniRatioChart
                        rows={item.chartRows}
                        baseline={item.baselineRatio}
                        thresholdPp={item.thresholdPp}
                        item={item.item}
                        L={L}
                      />
                    )}
                    <p className="mt-0.5 text-[11px] font-medium text-amber-800">→ {item.question}</p>
                    <textarea
                      value={notes[item.id] || ''}
                      onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                      rows={2}
                      placeholder={L('확인한 실제 사유를 입력하면 자동 저장됩니다.', 'Enter the confirmed reason; it saves automatically.')}
                      className="mt-1.5 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
                    />
                  </div>
                );
              })}
              {visibleChecks.length === 0 && (
                <p className="text-[11px] text-slate-400">{L('현재 수치에서 별도 확인이 필요한 주요 항목이 없습니다.', 'No major confirmation item found.')}</p>
              )}
            </div>
          </div>

          {confirmedChecks.length > 0 && (
            <div className="rounded-md border border-emerald-100 bg-emerald-50/70 p-2.5">
              <div className="text-[11px] font-semibold text-emerald-800 mb-1">
                {L('5. 확인 반영 보고 메모', '5. Confirmed report notes')}
              </div>
              <ul className="space-y-1 text-[12px] leading-relaxed text-slate-700">
                {confirmedChecks.map((item) => (
                  <li key={item.id}>
                    • <b>{item.title}</b>: {notes[item.id].trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-slate-400">
            {L(
              '※ 앱은 수치와 반복 패턴만 판단합니다. 실제 원인은 계약·운영·회계 담당자 확인 후 확정하세요. 입력 내용은 현재 이 기기에 자동 저장됩니다.',
              '※ The app only evaluates figures and recurring patterns. Confirm actual causes with contract, operations, or accounting owners. Notes are saved on this device.',
            )}
          </p>
        </div>
      )}
    </section>
  );
}
