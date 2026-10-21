import { useMemo, useState } from 'react';
import { customerRankings } from '../lib/customerRankings';
import { OPS_YEARS, opsActualCount } from '../lib/ops';
import { convertDisplayAmount, largeDisplayAmount, largeMoneyLabel, smallMoneyLabel } from '../lib/currency';
import { useLang } from '../context/LangContext';

export default function CustomerRankings({ rows, year, month, region, onPick }) {
  const { lang, currency } = useLang();
  const L = (ko, en, vi) => lang === 'en' ? en : lang === 'vi' ? vi : ko;
  const [profitField, setProfitField] = useState('grossProfit');
  const ranking = useMemo(() => {
    const previousYear = String(Number(year) - 1);
    return customerRankings(rows, { year, month, actualCount: opsActualCount(year),
      previousActualCount: OPS_YEARS.includes(previousYear) ? opsActualCount(previousYear) : 0,
      allowPreviousYear: region === '전체' || Number(year) >= 2026, profitField });
  }, [rows, year, month, region, profitField]);
  const unit = large => L(large ? largeMoneyLabel() : smallMoneyLabel(),
    currency === 'krw' ? large ? 'KRW 100m' : 'KRW m' : large ? 'VND bn' : 'VND m',
    large ? largeMoneyLabel() : smallMoneyLabel());
  const money = (value, large, delta = false) => {
    if (value == null) return '—';
    const amount = large ? largeDisplayAmount(value) : convertDisplayAmount(value);
    const standard = large ? delta ? 2 : 1 : currency === 'krw' ? 1 : 0;
    const precision = amount !== 0 && Math.abs(amount) < 1 ? Math.min(8, 1 - Math.floor(Math.log10(Math.abs(amount)))) : standard;
    return `${delta && amount > 0 ? '+' : ''}${amount.toLocaleString('ko-KR', { maximumFractionDigits: precision })}`;
  };
  const period = y => <><span className="block">{L(`${y}년`, y, y)}</span><span className="block text-[10px]">{L(`1~${ranking.endMonth}월`, `1–${ranking.endMonth}M`, `T1–T${ranking.endMonth}`)}</span></>;
  const status = row => {
    const labels = [];
    if (!row.current.complete) labels.push(L(`당년 ${row.current.recordedCount}/${row.current.periodCount}월`, `Current ${row.current.recordedCount}/${row.current.periodCount}M`, `Năm nay ${row.current.recordedCount}/${row.current.periodCount}T`));
    if (!row.previous.complete) labels.push(row.previous.recordedCount
      ? L(`전년 ${row.previous.recordedCount}/${row.previous.periodCount}월`, `Prior ${row.previous.recordedCount}/${row.previous.periodCount}M`, `Năm trước ${row.previous.recordedCount}/${row.previous.periodCount}T`)
      : L('전년 자료 확인', 'Check prior data', 'Kiểm tra năm trước'));
    if (labels.length) return <span className="text-amber-700">{labels.join(' · ')}</span>;
    return <span className="text-slate-400">{row.previous.value === 0 ? L('전년 0', 'Prior zero', 'Năm trước 0') : L('비교 가능', 'Comparable', 'Đủ dữ liệu')}</span>;
  };
  const revenueTitle = L('누계 매출 TOP 10', 'Top 10 by cumulative revenue', 'TOP 10 doanh thu lũy kế');
  const profitTitle = profitField === 'opProfit' ? L('누계 영업이익 TOP 10', 'Top 10 by cumulative operating profit', 'TOP 10 lợi nhuận hoạt động lũy kế')
    : L('누계 매출이익 TOP 10', 'Top 10 by cumulative gross profit', 'TOP 10 lợi nhuận gộp lũy kế');
  const table = (list, large, title) => <div className="overflow-x-auto scrollbar-thin">
    <table className="w-full min-w-[760px] text-sm" aria-label={title}>
      <thead className="border-b border-slate-100 text-xs text-slate-400"><tr>
        <th className="sticky left-0 z-10 bg-white p-2 text-left font-medium">{L('순위 · 고객사', 'Rank / customer', 'Hạng / khách hàng')}</th>
        <th className="p-2 text-right font-medium whitespace-nowrap">{period(ranking.previousYear)}</th>
        <th className="bg-blue-50 p-2 text-right font-medium text-blue-700 whitespace-nowrap">{period(year)}</th>
        <th className="p-2 text-right font-medium whitespace-nowrap">{L('증감액', 'Change', 'Chênh lệch')}</th>
        <th className="p-2 text-right font-medium whitespace-nowrap">{L('증감률', 'Change %', 'Biến động %')}</th>
        <th className="p-2 text-right font-medium whitespace-nowrap">{large ? L('매출 비중', 'Revenue share', 'Tỷ trọng DT') : L('이익률', 'Profit margin', 'Biên lợi nhuận')}</th>
        <th className="p-2 text-left font-medium whitespace-nowrap">{L('입력 확인', 'Coverage', 'Dữ liệu')}</th>
      </tr></thead>
      <tbody>{list.map(row => <tr key={row.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
        <th scope="row" className="sticky left-0 z-10 bg-white p-2 text-left font-medium">
          <div className="flex items-start gap-2"><span className={'mt-0.5 text-xs tabular-nums '+(row.rank <= 3 ? 'font-bold text-blue-700' : 'text-slate-400')}>{row.rank}</span>
            <button type="button" className="w-40 sm:w-52 text-left text-blue-700 hover:underline" title={row.name} onClick={() => onPick(row.name)}><span className="line-clamp-2 break-words">{row.name}</span></button></div>
        </th>
        <td className={'p-2 text-right tabular-nums whitespace-nowrap '+(row.previous.value < 0 ? 'text-red-500' : 'text-slate-500')}>{money(row.previous.value, large)}</td>
        <td className={'bg-blue-50 p-2 text-right tabular-nums font-semibold whitespace-nowrap '+(row.current.value < 0 ? 'text-red-500' : 'text-slate-800')}>{money(row.current.value, large)}</td>
        <td className={'p-2 text-right tabular-nums whitespace-nowrap '+(row.delta == null || row.delta === 0 ? 'text-slate-400' : row.delta > 0 ? 'text-blue-600' : 'text-red-500')}>{money(row.delta, large, true)}</td>
        <td className={'p-2 text-right tabular-nums whitespace-nowrap '+(row.pct == null || row.pct === 0 ? 'text-slate-400' : row.pct > 0 ? 'text-blue-600' : 'text-red-500')}>{row.pct == null ? '—' : `${row.pct > 0 ? '+' : ''}${row.pct.toFixed(1)}%`}</td>
        <td className="p-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{(large ? row.share : row.margin) == null ? '—' : `${(large ? row.share : row.margin).toFixed(1)}%`}</td>
        <td className="p-2 text-[10px] min-w-[112px]">{status(row)}</td>
      </tr>)}{!list.length && <tr><td colSpan={7} className="p-6 text-center text-slate-400">{L('선택한 조건의 입력 실적이 없습니다.', 'No recorded results for this scope.', 'Chưa có dữ liệu trong phạm vi đã chọn.')}</td></tr>}</tbody>
    </table>
  </div>;
  return <section aria-label={L('고객사 누계 TOP 10', 'Customer cumulative top 10', 'TOP 10 khách hàng lũy kế')} className="space-y-3">
    <p className="text-xs text-slate-500">{L(`1~${ranking.endMonth}월 입력 누계 기준 · 전년도도 같은 기간 비교 · 고객사명 클릭 → 상세`, `Ranked by recorded months 1–${ranking.endMonth}, with the same prior-year period. Click a customer for detail.`, `Xếp theo lũy kế đã nhập T1–T${ranking.endMonth}, so với cùng kỳ. Bấm tên để xem chi tiết.`)}</p>
    <section aria-label={revenueTitle} className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-semibold text-blue-800">{revenueTitle}</h2><span className="text-[11px] text-slate-400">{unit(true)}</span></div>
      <p className="text-xs text-slate-500">{L('TOP 10 합계', 'Top 10 total', 'Tổng TOP 10')} <b className="text-slate-700">{money(ranking.revenue.length ? ranking.topRevenue : null, true)}</b> {unit(true)}{ranking.topRevenueShare != null && <> · {L('현재 조건 전체 고객 매출의', 'of all customer revenue in scope', 'trong tổng DT khách hàng')} <b className="text-blue-700">{ranking.topRevenueShare.toFixed(1)}%</b></>}</p>
      {table(ranking.revenue, true, revenueTitle)}
    </section>
    <section aria-label={profitTitle} className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-emerald-800">{profitTitle}</h2>
        <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[11px] text-slate-400">{unit(false)}</span>{['grossProfit','opProfit'].map(field => <button key={field} type="button" aria-pressed={profitField === field} onClick={() => setProfitField(field)} className={'rounded-full border px-2.5 py-1 text-xs '+(profitField === field ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500')}>
          {field === 'grossProfit' ? L('매출이익', 'Gross profit', 'Lợi nhuận gộp') : L('영업이익', 'Operating profit', 'LN hoạt động')}</button>)}</div>
      </div>
      {table(ranking.profit, false, profitTitle)}
    </section>
    <p className="text-[11px] text-slate-500">{L('순위·비중은 현재 지역·사업·검색 조건의 입력 금액 기준입니다. 일부 월만 있으면 입력 개월을 표시하고 증감은 계산하지 않습니다. 전년 자료 없음은 신규 고객 판정이 아니며, 확인된 동일 고객사만 연결합니다. 이익률=누계 이익÷누계 매출.', 'Ranks and revenue shares use recorded amounts within the active region, business and search scope. Partial months suppress changes. Missing prior data does not imply a new customer; only confirmed aliases are joined. Margin = cumulative profit / revenue.', 'Hạng và tỷ trọng dựa trên dữ liệu đã nhập theo khu vực, ngành và tìm kiếm. Thiếu tháng không tính biến động. Thiếu dữ liệu năm trước không có nghĩa là khách mới; chỉ gộp tên đã xác nhận. Biên LN = LN lũy kế / DT lũy kế.')}</p>
  </section>;
}
