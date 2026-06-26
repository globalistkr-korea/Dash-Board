import { useEffect, useMemo, useState } from 'react';
import {
  entityDetails, marginDiagnosis, costItemCompare, costItemContributors,
  costDataQualityAlerts, costRatioOutliers, subtypeToBiz,
} from '../lib/variance';
import { useLang } from '../context/LangContext';

const NOTE_PREFIX = 'vn_dashboard_report_notes_v1:';
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
const THRESHOLDS = [3, 5, 10];
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
const contributionText = (rows, L, direction = 'increase') => rows.map((row) => {
  const shareLabel = direction === 'increase' ? L('증가 대상 내', 'share among increases') : L('감소 대상 내', 'share among decreases');
  const share = row.share != null ? `, ${shareLabel} ${row.share.toFixed(0)}%` : '';
  const rate = row.ratioDeltaPp != null ? `, ${L('원가율', 'cost ratio')} ${ratio(row.ratioPrev)}→${ratio(row.ratioCur)}(${pp(row.ratioDeltaPp)})` : '';
  return `${row.name} ${row.delta >= 0 ? '+' : ''}${money(row.delta)}${L('백만동', ' M dong')} (${money(row.prev)}→${money(row.cur)}${rate})${share}`;
}).join(' · ');

function MiniRatioChart({ rows = [], baseline, thresholdPp, L }) {
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
        <span>{L('기준', 'base')} {ratio(baseline)} · ±{thresholdPp}%p</span>
      </div>
      <div className="flex items-end gap-2">
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
      </div>
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

function loadNotes(key) {
  try {
    return JSON.parse(localStorage.getItem(NOTE_PREFIX + key) || '{}');
  } catch {
    return {};
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
  const [baseline, setBaseline] = useState('curYtd');
  const [thresholdPp, setThresholdPp] = useState(5);
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
    () => costRatioOutliers(region, clff, biz, cmp, 5, { basis: baseline, thresholdPp }),
    [region, clff, biz, cmp, baseline, thresholdPp],
  );
  const noteKey = [
    cmp.by, cmp.bm.join('-'), cmp.cy, cmp.cm.join('-'), region, clff, subtype,
  ].join(':');
  const [notes, setNotes] = useState(() => loadNotes(noteKey));
  const [open, setOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem(NOTE_PREFIX + noteKey, JSON.stringify(notes));
  }, [noteKey, notes]);

  const increases = costs.filter((item) => item.delta > 0);
  const decreases = costs
    .filter((item) => item.delta < 0 && item.prev >= 100 && (item.cur === 0 || item.cur <= item.prev * 0.3))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);
  const totalIncrease = increases.reduce((sum, item) => sum + item.delta, 0);
  const topCosts = increases.slice(0, 3);
  const topRateOutliers = rateOutliers.slice(0, 4);
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
      urgent: Math.abs(item.basisDeltaPp || 0) >= thresholdPp,
      title: L(`${cleanItem(item.item)} 원가율 이탈`, `${cleanItem(item.item)} cost-ratio deviation`),
      evidence: L(
        `금액은 ${money(item.prev)} → ${money(item.cur)}백만동(${item.delta >= 0 ? '+' : ''}${money(item.delta)})이고, 매출 대비 원가율은 ${ratio(item.ratioCur)}입니다. 선택 기준선 ${selectedBaselineLabel} ${ratio(item.baselineRatio)} 대비 ${pp(item.basisDeltaPp)}로, 임계값 ${thresholdPp}%p를 벗어났습니다. 참고로 ${curAvgLabel} 대비 ${pp(item.avgDeltaPp)}, ${prevAvgLabel} 대비 ${pp(item.prevAvgDeltaPp)}입니다.`,
        `Amount moved ${money(item.prev)} → ${money(item.cur)} M dong (${item.delta >= 0 ? '+' : ''}${money(item.delta)}), and the cost ratio is ${ratio(item.ratioCur)}. It is ${pp(item.basisDeltaPp)} vs the selected baseline ${selectedBaselineLabel} ${ratio(item.baselineRatio)}, beyond the ${thresholdPp}pp threshold. For reference: ${pp(item.avgDeltaPp)} vs 2026 YTD and ${pp(item.prevAvgDeltaPp)} vs 2025 same-period.`,
      ),
      chartRows: baseline === 'recent3' ? item.ratioTrend3 : item.ratioTrend5,
      baselineRatio: item.baselineRatio,
      thresholdPp,
      warehouseDetail: warehouseDrivers.length
        ? contributionText(warehouseDrivers, L, direction)
        : L('원가율 이탈 창고 특정 불가', 'No warehouse ratio driver identified'),
      customerDetail: customerDrivers.length
        ? contributionText(customerDrivers, L, direction)
        : L('고객사 배부 데이터에서 원가율 이탈 대상 특정 불가', 'No customer ratio driver identified in allocated data'),
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
  const confirmedChecks = checks.filter((item) => notes[item.id]?.trim());

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
                    onClick={() => setBaseline(option.value)}
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
                    onClick={() => setThresholdPp(value)}
                    className={`rounded-full px-2 py-0.5 text-[10px] border ${thresholdPp === value ? 'border-rose-500 bg-rose-50 text-rose-700 font-semibold' : 'border-slate-200 bg-white text-slate-500'}`}
                  >
                    ±{value}%p
                  </button>
                ))}
                <span className="text-[10px] text-slate-400">
                  {L('기본 5%p · 선택 즉시 아래 확인 대상이 갱신됩니다.', 'Default 5pp · changing it updates the checks below.')}
                </span>
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

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="text-[11px] font-semibold text-slate-500">
                {L('3. 담당자 확인 필요', '3. Needs owner confirmation')}
              </div>
              <span className="text-[10px] text-slate-400">
                {confirmedChecks.length}/{checks.length} {L('확인', 'confirmed')}
              </span>
            </div>
            <div className="space-y-2">
              {checks.map((item) => {
                const confirmed = Boolean(notes[item.id]?.trim());
                return (
                  <div key={item.id} className={`rounded-md border bg-white p-2 ${item.urgent ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${confirmed ? 'bg-emerald-100 text-emerald-700' : item.urgent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {confirmed ? L('확인 완료', 'Confirmed') : item.urgent ? L('입력 점검', 'Input check') : L('확인 필요', 'Check')}
                      </span>
                      <b className="text-[12px] text-slate-700">{item.title}</b>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.evidence}</p>
                    {item.warehouseDetail && (
                      <div className="mt-1 rounded bg-blue-50/80 px-2 py-1 text-[11px] leading-relaxed text-blue-900">
                        <b>{L('어디 창고', 'Warehouses')}:</b> {item.warehouseDetail}
                      </div>
                    )}
                    {item.customerDetail && (
                      <div className="mt-1 rounded bg-violet-50/80 px-2 py-1 text-[11px] leading-relaxed text-violet-900">
                        <b>{L('어느 고객사', 'Customers')}:</b> {item.customerDetail}
                        <span className="block text-[10px] text-violet-500">
                          {L('※ 고객사 원가는 운영 배부 기준 참고치이며 창고 합계와 다를 수 있습니다.', '※ Customer costs are allocated operational figures and may differ from warehouse totals.')}
                        </span>
                      </div>
                    )}
                    {item.chartRows && (
                      <MiniRatioChart
                        rows={item.chartRows}
                        baseline={item.baselineRatio}
                        thresholdPp={item.thresholdPp}
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
              {checks.length === 0 && (
                <p className="text-[11px] text-slate-400">{L('현재 수치에서 별도 확인이 필요한 주요 항목이 없습니다.', 'No major confirmation item found.')}</p>
              )}
            </div>
          </div>

          {confirmedChecks.length > 0 && (
            <div className="rounded-md border border-emerald-100 bg-emerald-50/70 p-2.5">
              <div className="text-[11px] font-semibold text-emerald-800 mb-1">
                {L('4. 확인 반영 보고 메모', '4. Confirmed report notes')}
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
