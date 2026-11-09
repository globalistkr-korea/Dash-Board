import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLang } from '../context/LangContext';
import { convertDisplayAmount, smallMoneyLabel } from '../lib/currency';
import { opsActualCount, opsList, OPS_SOURCE, OPS_YEARS, segKeys } from '../lib/ops';
import { operatingProfitWatch, WATCH_METRICS, watchBusinessScope } from '../lib/operatingProfitWatch';
import { makeAnalysisPayload } from '../lib/analysisPayload';
import AnalysisAction from './AnalysisAction';

const labels = {
  revenue: ['매출', 'Revenue', 'Doanh thu'],
  costOfSales: ['매출원가', 'Cost of sales', 'Giá vốn'],
  grossProfit: ['매출이익', 'Gross profit', 'Lợi nhuận gộp'],
  sga: ['판관비', 'SG&A', 'Chi phí BH & QLDN'],
  opProfit: ['영업이익', 'Operating profit', 'Lợi nhuận hoạt động'],
  opMargin: ['영업이익률', 'Operating margin', 'Biên LN hoạt động'],
};
const groups = {
  customers: ['고객사', 'Customers', 'Khách hàng'],
  warehouses: ['창고', 'Warehouses', 'Kho'],
};
const businessLabels = {
  창고: ['CL 창고', 'CL Warehousing', 'CL Kho bãi'],
  운송: ['CL 운송', 'CL Transport', 'CL Vận tải'],
  'CL 기타': ['CL 기타', 'CL Other', 'CL Khác'],
  FF: ['FF', 'FF', 'FF'],
  기타: ['기타', 'Other', 'Khác'],
};
const counts = Object.fromEntries(OPS_YEARS.map(year => [year, opsActualCount(year)]));
const numberFormat = (value, digits) => value.toLocaleString('ko-KR', { maximumFractionDigits: digits });
function money(value, currency, signed = false) {
  if (value == null) return '—';
  const amount = convertDisplayAmount(value);
  const digits = amount && Math.abs(amount) < 1 ? Math.min(6, 1 - Math.floor(Math.log10(Math.abs(amount)))) : currency === 'krw' ? 1 : 0;
  return `${signed && amount > 0 ? '+' : ''}${numberFormat(amount, digits)}`;
}
function rate(value, isDelta = false) {
  if (value == null) return '—';
  const rounded = Math.round(value * 100) / 100;
  return `${isDelta && rounded > 0 ? '+' : ''}${numberFormat(rounded, 2)}${isDelta ? '%p' : '%'}`;
}
const tone = (value, cost = false) => value == null || value === 0 ? 'text-slate-400'
  : (cost ? value > 0 : value < 0) ? 'text-red-600' : 'text-blue-700';

export default function OperatingProfitWatch({ cmp, region, clff, subtype }) {
  const { lang, currency, t } = useLang();
  const L = (ko, en, vi) => lang === 'en' ? en : lang === 'vi' ? vi : ko;
  const [selected, setSelected] = useState(null);
  const detailId = useId();
  const headingId = useId();
  const detailRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!selected) return;
    detailRef.current?.focus({ preventScroll: true });
    detailRef.current?.scrollIntoView({ block: 'start' });
  }, [selected]);

  const biz = watchBusinessScope(clff, subtype);
  const rankings = useMemo(() => {
    if (!cmp || biz == null) return null;
    return Object.fromEntries(Object.keys(groups).map(kind => {
      const entities = opsList(kind, region, clff).map(e => ({
        name: e.name, region: e.region, segments: segKeys(e, clff, biz)
          .filter(key => e.data[key]).map(business => ({ ...e.data[business], business })),
      }));
      return [kind, operatingProfitWatch(entities, cmp, counts)];
    }));
  }, [cmp, region, clff, biz]);

  const title = L('영업이익 악화 TOP 5', 'Top 5 operating profit declines', 'TOP 5 giảm lợi nhuận hoạt động');
  const period = (year, months) => {
    const range = months.length === 1 ? months[0] + 1 : `${months[0] + 1}~${months.at(-1) + 1}`;
    return L(`${year}년 ${range}월`, `${year} · M${range}`, `T${range}/${year}`);
  };
  const before = cmp ? period(cmp.by, cmp.bm) : '';
  const after = cmp ? period(cmp.cy, cmp.cm) : '';
  const scope = [t(region), clff !== '전체' ? t(clff) : null, subtype !== '전체' ? t(subtype) : null].filter(Boolean).join(' · ');
  const businesses = row => Object.entries(businessLabels).filter(([key]) => row.businesses.includes(key))
    .map(([, label]) => L(...label));
  const detailScope = selected?.kind === 'customers' ? businesses(selected.row)
    : [clff !== '전체' ? t(clff) : null, subtype !== '전체' ? t(subtype) : null];
  const unit = smallMoneyLabel();
  const close = () => { setSelected(null); triggerRef.current?.focus(); };

  return <section aria-labelledby={headingId} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-1.5">
      <h2 id={headingId} className="text-sm font-semibold text-slate-800">{title}</h2>
      {cmp && <p className="text-[11px] text-slate-500">{scope} · {before} → {after} · {unit}</p>}
    </div>
    {!rankings ? <p className="text-xs text-slate-500">{!cmp
      ? L('이 기간의 비교 자료가 없습니다.', 'No comparable period is available.', 'Không có kỳ để so sánh.')
      : L('선택한 세부 사업의 고객사·창고 구분이 원본에 없습니다. 세부를 ‘전체’로 바꿔 확인하세요.', 'Entity data does not separate this subtype. Choose All subtypes to review.', 'Dữ liệu đơn vị không tách nhóm này. Chọn tất cả nhóm để xem.')}</p>
      : <>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {Object.entries(rankings).map(([kind, { rows, excluded }]) => {
            const group = L(...groups[kind]);
            return <div key={kind} className="min-w-0 rounded-lg border border-slate-100">
              <h3 className="px-2.5 pt-2 text-xs font-semibold text-slate-700">{group}</h3>
              <div className="overflow-x-auto scrollbar-thin">
                <table aria-label={`${group} · ${title}`} className="w-full min-w-[475px] text-xs">
                  <thead><tr className="border-b border-slate-100 text-[10px] text-slate-500">
                    <th scope="col" className="sticky left-0 bg-white px-2.5 py-2 text-left font-medium">{group}</th>
                    <th scope="col" className="bg-rose-50 px-2 py-2 text-right font-medium">{L('영업이익 증감', 'OP change', 'Chênh lệch LN HĐ')}</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">{L('영업이익률 변화', 'Margin change', 'Biên LN thay đổi')}</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">{L('매출이익 증감', 'GP change', 'Chênh lệch LN gộp')}</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">{L('판관비 증감', 'SG&A change', 'Chênh lệch chi phí')}</th>
                  </tr></thead>
                  <tbody>{rows.map((row, i) => {
                    const expanded = selected?.kind === kind && selected.row.name === row.name;
                    return <tr key={row.name} className={`border-b border-slate-50 ${expanded ? 'bg-blue-50/60' : ''}`}>
                      <th scope="row" className={`sticky left-0 min-w-[110px] max-w-[210px] px-2.5 py-2 text-left font-medium ${expanded ? 'bg-blue-50' : 'bg-white'}`}>
                        <button type="button" title={row.name} aria-expanded={expanded} aria-controls={detailId} onClick={event => {
                          triggerRef.current = event.currentTarget;
                          if (expanded) close(); else setSelected({ kind, row });
                        }} className="flex items-start gap-1.5 text-left text-blue-700 hover:underline">
                          <span aria-hidden="true" className="text-[10px] text-slate-400">{i + 1}</span>
                          <span className="line-clamp-2 break-words">{row.name}</span>
                        </button>
                        {kind === 'customers' && <p className="ml-3 mt-0.5 text-[10px] text-slate-600">{businesses(row).join(' · ')}</p>}
                        {row.before.opProfit >= 0 && row.after.opProfit < 0 &&
                          <span className="ml-3 text-[10px] font-medium text-red-600">{L('적자 전환', 'Turned loss', 'Chuyển lỗ')}</span>}
                      </th>
                      <td className="bg-rose-50/70 px-2 py-2 text-right tabular-nums font-semibold text-red-700 whitespace-nowrap">{money(row.delta.opProfit, currency, true)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${tone(row.delta.opMargin)}`} title={`${rate(row.before.opMargin)} → ${rate(row.after.opMargin)}`}>{rate(row.delta.opMargin, true)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${tone(row.delta.grossProfit)}`}>{money(row.delta.grossProfit, currency, true)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${tone(row.delta.sga, true)}`}>{money(row.delta.sga, currency, true)}</td>
                    </tr>;
                  })}
                  {!rows.length && <tr><td colSpan={5} className="px-2.5 py-3 text-slate-500">{L('비교 가능한 영업이익 감소 건이 없습니다.', 'No comparable declines.', 'Không có trường hợp giảm có thể so sánh.')}</td></tr>}
                  </tbody>
                </table>
              </div>
              {excluded > 0 && <p className="px-2.5 py-1.5 text-[10px] text-slate-500">
                {L(`영업이익 미입력·행 없음 ${excluded}건 제외`, `${excluded} excluded: missing profit or records`, `Loại ${excluded} trường hợp thiếu lợi nhuận hoặc dữ liệu`)}
              </p>}
            </div>;
          })}
        </div>
        <p className="text-[11px] text-slate-500">{L('감소액이 큰 순 · 이름을 누르면 상세 · 판관비 = 매출이익 − 영업이익 · —는 비교 자료 부족', 'Largest declines first · Select a name for details · SG&A = gross profit − operating profit · — means insufficient inputs', 'Mức giảm lớn nhất trước · Bấm tên để xem · Chi phí = LN gộp − LN hoạt động · — là thiếu dữ liệu')}</p>
      </>}
    <div id={detailId} hidden={!selected}>
      {selected && rankings && <div ref={detailRef} tabIndex={-1} className="scroll-mt-20 rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{selected.row.name} · {L('손익 상세', 'P&L detail', 'Chi tiết kết quả kinh doanh')}</h3>
          <div className="flex items-center gap-2">
            <AnalysisAction payload={makeAnalysisPayload({
              source: OPS_SOURCE, kind: selected.kind, entity: selected.row.name, item: '영업이익',
              scope: [selected.row.region, clff, subtype].join('|'), period: cmp, reason: 'operating-profit-decline',
              title: `${selected.row.name} 영업이익 감소 확인`,
              evidence: `${before} → ${after} · 영업이익 ${money(selected.row.before.opProfit, currency)} → ${money(selected.row.after.opProfit, currency)} ${unit}`,
              impact: `영업이익 증감 ${money(selected.row.delta.opProfit, currency, true)} ${unit}`,
              question: '매출이익과 판관비 변화를 기준으로 물량·단가·일회성 비용·배부 변경 여부를 확인해주세요.',
              facts: selected.row.delta,
            })}/>
            <button type="button" onClick={close} className="rounded-lg border bg-white px-2 py-1 text-xs text-slate-600">{L('상세 닫기', 'Close details', 'Đóng chi tiết')}</button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">{[t(selected.row.region), ...detailScope, unit].filter(Boolean).join(' · ')}</p>
        <div className="overflow-x-auto scrollbar-thin">
          <table aria-label={L('선택 대상 손익 비교', 'Selected entity P&L comparison', 'So sánh kết quả đơn vị đã chọn')} className="w-full min-w-[360px] text-xs">
            <thead><tr className="border-b border-blue-100 text-slate-500">
              <th scope="col" className="p-2 text-left font-medium">{L('항목', 'Metric', 'Chỉ tiêu')}</th>
              <th scope="col" className="p-2 text-right font-medium whitespace-nowrap">{before}</th>
              <th scope="col" className="p-2 text-right font-medium whitespace-nowrap">{after}</th>
              <th scope="col" className="p-2 text-right font-medium">{L('증감', 'Change', 'Thay đổi')}</th>
            </tr></thead>
            <tbody>{WATCH_METRICS.map(field => {
              const fmt = (value, delta) => field === 'opMargin' ? rate(value, delta) : money(value, currency, delta);
              const row = selected.row;
              return <tr key={field} className={`border-b border-blue-50 ${field === 'opProfit' ? 'bg-blue-100/50 font-semibold' : ''}`}>
                <th scope="row" className="p-2 text-left font-medium">{L(...labels[field])}</th>
                <td className="p-2 text-right tabular-nums">{fmt(row.before[field])}</td>
                <td className="p-2 text-right tabular-nums">{fmt(row.after[field])}</td>
                <td className={`p-2 text-right tabular-nums ${tone(row.delta[field], field === 'sga' || field === 'costOfSales')}`}>{fmt(row.delta[field], true)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </div>}
    </div>
  </section>;
}
