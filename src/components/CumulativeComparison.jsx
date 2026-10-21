import { cumulativeComparison } from '../lib/cumulativeComparison';
import { OPS_YEARS, opsActualCount } from '../lib/ops';
import { largeMoneyLabel, smallMoneyLabel, largeDisplayAmount, convertDisplayAmount } from '../lib/currency';
import { useLang } from '../context/LangContext';

const metrics = {
  revenue: ['매출', 'Revenue', 'Doanh thu'], directCost: ['직접원가', 'Direct cost', 'Chi phí trực tiếp'],
  directProfit: ['직접이익', 'Direct profit', 'Lợi nhuận trực tiếp'], indirectCost: ['간접원가', 'Indirect cost', 'Chi phí gián tiếp'],
  grossProfit: ['매출이익', 'Gross profit', 'Lợi nhuận gộp'], opProfit: ['영업이익', 'Operating profit', 'Lợi nhuận hoạt động'],
  opMargin: ['영업이익률', 'Operating margin', 'Biên lợi nhuận hoạt động'],
};
const isLarge = field => ['revenue', 'directCost'].includes(field);
const isCost = field => ['directCost', 'indirectCost'].includes(field);

export default function CumulativeComparison({ v, year, month }) {
  const { lang, currency } = useLang();
  const L = (ko, en, vi) => lang === 'en' ? en : lang === 'vi' ? vi : ko;
  const previousYear = String(Number(year) - 1);
  const result = cumulativeComparison(v, { year, month, actualCount: opsActualCount(year),
    previousActualCount: OPS_YEARS.includes(previousYear) ? opsActualCount(previousYear) : 0 });
  const endEnglish = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][result.endMonth - 1];
  const period = y => <><span className="block">{L(`${y}년`, `${y}`, `${y}`)}</span><span className="block text-[10px]">{L(`1~${result.endMonth}월`, `Jan–${endEnglish}`, `T1–T${result.endMonth}`)}</span></>;
  const unit = field => field === 'opMargin' ? '%' : isLarge(field)
    ? L(largeMoneyLabel(), currency === 'krw' ? 'KRW 100m' : 'VND bn', largeMoneyLabel())
    : L(smallMoneyLabel(), currency === 'krw' ? 'KRW m' : 'VND m', smallMoneyLabel());
  const money = (value, field, delta = false) => {
    if (field === 'opMargin') return `${value.toFixed(1)}${delta ? '%p' : '%'}`;
    const amount = isLarge(field) ? largeDisplayAmount(value) : convertDisplayAmount(value);
    const standard = isLarge(field) ? delta ? 2 : 1 : currency === 'krw' ? 1 : 0;
    const precision = amount !== 0 && Math.abs(amount) < 1 ? Math.min(8, 1 - Math.floor(Math.log10(Math.abs(amount)))) : standard;
    return amount.toLocaleString('ko-KR', { maximumFractionDigits: precision });
  };
  const stateText = state => state === 'unavailable' ? L('자료 없음', 'Unavailable', 'Chưa có dữ liệu')
    : state === 'noRows' ? L('행 없음', 'No rows', 'Không có dòng')
      : state === 'zeroRevenue' ? L('매출 0', 'Zero revenue', 'Doanh thu 0') : L('미입력', 'Not entered', 'Chưa nhập');
  const cell = (measure, field) => <>
    <span className={measure.value < 0 ? 'text-red-500' : ''}>{measure.value == null ? stateText(measure.status) : money(measure.value, field)}</span>
    {!measure.complete && measure.recordedCount > 0 && <span className="block text-[10px] text-amber-700">{measure.recordedCount}/{measure.periodCount} {L('월 입력', 'months entered', 'tháng có dữ liệu')}</span>}
  </>;
  const incomplete = result.rows.some(r => !r.previous.complete || !r.current.complete);
  const negativeBaseline = result.rows.some(r => r.previous.complete && r.previous.value < 0 && r.field !== 'opMargin');
  const zeroBaseline = result.rows.some(r => r.field !== 'opMargin' && r.previous.complete && r.previous.value === 0);

  return <section aria-label={L('전년 동일기간 누계 비교', 'Same-period cumulative comparison', 'So sánh lũy kế cùng kỳ')}
    className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-blue-800">{L('전년 동일기간 누계 비교', 'Same-period cumulative comparison', 'So sánh lũy kế cùng kỳ')}</h3>
      <span className="text-[11px] text-slate-500">{L(`1~${result.endMonth}월 누계`, `Jan–${endEnglish} cumulative`, `Lũy kế T1–T${result.endMonth}`)}</span>
    </div>
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[500px] text-sm" aria-label={L('전년 동일기간 누계 손익', 'Same-period cumulative P&L', 'Lợi nhuận lũy kế cùng kỳ')}>
        <thead className="border-b border-slate-100 text-xs text-slate-500"><tr>
          {[L('항목', 'Metric', 'Chỉ tiêu'), period(result.previousYear), period(year), L('증감', 'Change', 'Biến động'), L('증감률', 'Change %', 'Biến động %')].map((label, i) =>
            <th key={i} className={'whitespace-nowrap px-2.5 py-2 font-medium '+(i === 0 ? 'sticky left-0 z-10 bg-white text-left' : 'text-right '+(i === 2 ? 'bg-blue-50' : ''))}>{label}</th>)}
        </tr></thead>
        <tbody>{result.rows.map(row => {
          const favorable = row.delta != null && (isCost(row.field) ? row.delta < 0 : row.delta > 0);
          const deltaClass = row.delta == null || row.delta === 0 ? 'text-slate-400' : favorable ? 'text-blue-600' : 'text-red-500';
          return <tr key={row.field} className="border-b border-slate-50 last:border-0">
            <th scope="row" className="sticky left-0 z-10 bg-white px-2.5 py-2 text-left font-medium text-slate-700 whitespace-nowrap">
              {L(...metrics[row.field])}<span className="block text-[9px] font-normal text-slate-400">{unit(row.field)}</span>
            </th>
            <td className="px-2.5 py-2 text-right tabular-nums whitespace-nowrap">{cell(row.previous, row.field)}</td>
            <td className="bg-blue-50 px-2.5 py-2 text-right tabular-nums font-semibold whitespace-nowrap">{cell(row.current, row.field)}</td>
            <td className={'px-2.5 py-2 text-right tabular-nums whitespace-nowrap '+deltaClass}>{row.delta == null ? '—' : `${row.delta > 0 ? '+' : ''}${money(row.delta, row.field, true)}`}</td>
            <td className={'px-2.5 py-2 text-right tabular-nums whitespace-nowrap '+deltaClass}>{row.pct == null ? '—' : `${row.pct > 0 ? '+' : ''}${row.pct.toFixed(1)}%`}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="text-[11px] text-slate-500">{L('월을 선택하면 해당 월까지의 누계로 비교합니다. 영업이익률은 누계 영업이익 ÷ 누계 매출이며 차이는 %p입니다.', 'A selected month sets the cumulative end month. Operating margin uses cumulative profit / revenue; its change is in percentage points.', 'Tháng được chọn là tháng cuối lũy kế. Biên LN = LN lũy kế / doanh thu lũy kế; chênh lệch tính bằng điểm %.')}</p>
    {incomplete && <p className="text-[11px] text-amber-700">{L('입력 확인 필요 · 일부 월만 있으면 확인된 합계와 입력 개월을 표시하고 증감 비교에서 제외합니다. 원본 이름·지역·사업이 달라 연결되지 않은 실적도 확인해주세요.', 'Check input coverage: partial totals show entered months and do not produce changes. Check unmatched source names, regions or businesses.', 'Kiểm tra dữ liệu: tổng chưa đủ tháng không tính biến động. Kiểm tra tên gốc, khu vực và ngành chưa liên kết.')}</p>}
    {(negativeBaseline || zeroBaseline) && <p className="text-[11px] text-slate-500">{L('증감률 = (당년−전년) ÷ |전년| · 전년이 0이면 증감률은 표시하지 않습니다.', 'Change % = (current − prior) / |prior|. A zero prior value has no change %.', 'Biến động % = (năm nay − năm trước) / |năm trước|. Không tính % khi năm trước bằng 0.')}</p>}
  </section>;
}
