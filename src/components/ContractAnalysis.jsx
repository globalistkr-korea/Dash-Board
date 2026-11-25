import { Fragment, useMemo, useState } from 'react';
import { useLang } from '../context/LangContext';
import { todayVN } from '../lib/decisions';
import { OPS_CURRENT, OPS_SOURCE, opsActualCount, opsList } from '../lib/ops';
import { contractMonth, linkWarehouseContracts, monthBounds, renewalStatus } from '../lib/contractAnalysis';

const LABELS = {
  WH: ['창고 임대', 'Warehouse lease', 'Thuê kho'],
  CUSTOMER: ['고객 청구', 'Customer billing', 'Phí khách hàng'],
  'WH Vendor': ['벤더 비용', 'Vendor fees', 'Phí nhà cung cấp'],
  all: ['전체', 'All', 'Tất cả'],
  soon: ['60일 이내', 'Within 60 days', 'Trong 60 ngày'],
  past: ['기록상 종료일 경과', 'Recorded end date passed', 'Đã qua ngày kết thúc ghi nhận'],
  unknown: ['종료일 확인 필요', 'End date to verify', 'Cần kiểm tra ngày kết thúc'],
  ended: ['종료 명시', 'Termination stated', 'Đã ghi nhận chấm dứt'],
  later: ['60일 이후', 'Beyond 60 days', 'Sau 60 ngày'],
  category: ['계약 구분', 'Contract type', 'Loại hợp đồng'],
  party: ['계약 대상', 'Contract party', 'Đối tác'],
  warehouse: ['창고', 'Warehouse', 'Kho'],
  end: ['종료일 (기록)', 'Recorded end date', 'Ngày kết thúc ghi nhận'],
  renewal: ['자동갱신 조건', 'Auto-renewal clause', 'Điều khoản tự gia hạn'],
  status: ['검토 상태', 'Review status', 'Trạng thái xem xét'],
  notice: ['해지 사전통보', 'Termination notice', 'Báo trước chấm dứt'],
  check: ['원본 확인', 'Check source', 'Kiểm tra nguồn'],
  basisDate: ['기준일', 'As of', 'Tính đến'],
  compareMonth: ['비교 월', 'Comparison month', 'Tháng so sánh'],
  recordedAmounts: ['원본 계약 월액', 'Recorded monthly contract amounts', 'Số tiền tháng trong hợp đồng'],
  actual: ['실제 손익 · 북부 창고', 'Actual P&L · North warehousing', 'P&L thực tế · Kho miền Bắc'],
  revenue: ['매출', 'Revenue', 'Doanh thu'],
  rental: ['창고 임차료', 'Warehouse rent', 'Tiền thuê kho'],
  directCost: ['직접원가', 'Direct cost', 'Chi phí trực tiếp'],
  opProfit: ['영업이익', 'Operating profit', 'Lợi nhuận hoạt động'],
  unit: ['단위 백만동', 'Million VND', 'Triệu VND'],
  confirmed: ['월액 반영', 'Monthly amount included', 'Đã tính số tiền tháng'],
  outside: ['선택 월 외', 'Outside month', 'Ngoài tháng đã chọn'],
  partial: ['월중 시작·종료', 'Part-month term', 'Kỳ hợp đồng một phần tháng'],
  dateCheck: ['적용 기간 확인', 'Verify term', 'Kiểm tra thời hạn'],
  amountCheck: ['월액 확인', 'Verify monthly amount', 'Kiểm tra số tiền tháng'],
  terminationCheck: ['종료 시점 확인', 'Verify termination timing', 'Kiểm tra thời điểm chấm dứt'],
  inHouse: ['자가 운영', 'In-house operation', 'Vận hành nội bộ'],
  unlinked: ['창고 연결 보류', 'Warehouse match pending', 'Chờ đối chiếu kho'],
  unlinkedNote: ['복수 창고·공통 비용과 손익에서 같은 창고를 확인할 수 없는 계약입니다.', 'Includes shared costs, multiple sites, and contracts without a clear P&L site match.', 'Gồm chi phí chung, nhiều kho và hợp đồng chưa đối chiếu được kho trong P&L.'],
  dateNote: ['종료일까지의 남은 일수입니다. 갱신 여부와 해지 통보 기한은 계약서에서 확인하세요.', 'Days refer to the recorded end date. Verify renewal and notice deadlines in the contract.', 'Số ngày đến ngày kết thúc ghi nhận. Xác minh gia hạn và hạn báo trước trong hợp đồng.'],
  compareNote: ['월 전체가 기록상 계약기간에 포함되고 단일 창고와 숫자 월액이 확인되는 건을 합산합니다. 일부 조건·요율은 시트 확인일 기준입니다. 실제 임차료는 PNL 05번 창고 임차료 계정입니다.', 'Totals include numeric monthly amounts for a single matched site when the recorded term covers the full month. Some terms and rates reflect the sheet snapshot. Actual rent uses P&L account 05.', 'Cộng số tiền tháng của hợp đồng xác định được một kho và có thời hạn bao phủ cả tháng. Một số điều khoản và đơn giá theo thời điểm chụp bảng nguồn. Tiền thuê thực tế dùng tài khoản P&L 05.'],
  pnlSource: ['실적 원본', 'P&L source', 'Nguồn P&L'],
  noResults: ['해당하는 계약이 없습니다.', 'No matching contracts.', 'Không có hợp đồng phù hợp.'],
  contractAmount: ['기재 월액', 'Recorded monthly amount', 'Số tiền tháng ghi nhận'],
  sourceDetails: ['계약 상세', 'Contract details', 'Chi tiết hợp đồng'],
  included: ['월액 반영', 'Included in monthly amount', 'Đã tính số tiền tháng'],
};

const TYPE_KEYS = ['WH', 'CUSTOMER', 'WH Vendor'];
const STATUS_KEYS = ['soon', 'past', 'unknown', 'ended', 'later', 'all'];
const STATUS_STYLE = {
  soon: 'bg-amber-100 text-amber-900', past: 'bg-red-100 text-red-900', unknown: 'bg-slate-100 text-slate-700',
  ended: 'bg-slate-100 text-slate-700', later: 'bg-blue-50 text-blue-800',
};
const RENTAL_ACCOUNT = '05. RENTAL FEE(WH)';
const PNL_FIELDS = ['rental', 'revenue', 'directCost', 'opProfit'];
const cell = 'px-3 py-2.5 align-top';
const numberCell = `${cell} text-right tabular-nums`;
const filterStyle = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';

function useAnalysisLabels() {
  const { lang } = useLang();
  const index = { ko: 0, en: 1, vi: 2 }[lang] ?? 0;
  return key => LABELS[key][index];
}

function ContractName({ record, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(record)} className="text-left font-semibold text-blue-800 hover:underline">
      {record.name}
    </button>
  );
}

export function RenewalReview({ tabs, onOpen }) {
  const text = useAnalysisLabels();
  const [status, setStatus] = useState('soon');
  const [type, setType] = useState('all');
  const today = todayVN();
  const reviewed = useMemo(() => tabs.flatMap(tab => tab.records.map(record => ({
    record, ...renewalStatus(record, today),
  }))).sort((a, b) => (a.end || '9999').localeCompare(b.end || '9999') || a.record.name.localeCompare(b.record.name)), [tabs, today]);
  const scoped = type === 'all' ? reviewed : reviewed.filter(row => row.record.sheet === type);
  const rows = status === 'all' ? scoped : scoped.filter(row => row.status === status);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select aria-label={text('category')} className={filterStyle} value={type} onChange={event => setType(event.target.value)}>
          {['all', ...TYPE_KEYS].map(key => <option key={key} value={key}>{text(key)}</option>)}
        </select>
        <p className="text-xs text-slate-500">{text('basisDate')} {today}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={text('status')}>
        {STATUS_KEYS.map(key => (
          <button key={key} type="button" onClick={() => setStatus(key)} aria-pressed={status === key}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === key ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
            {text(key)} <span className="opacity-80">{key === 'all' ? scoped.length : scoped.filter(row => row.status === key).length}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">{text('dateNote')}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>{['party', 'end', 'status', 'renewal', 'notice'].map(key => <th scope="col" key={key} className={cell}>{text(key)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(({ record, end, remainingDays, status: state }) => (
              <tr key={record.id} className="border-t border-slate-100">
                <td className={cell}><ContractName record={record} onOpen={onOpen} /><div className="mt-1 text-slate-500">{text(record.sheet)}{record.sheet !== 'WH' && record.location ? ` · ${record.location}` : ''}</div></td>
                <td className={cell}><span className="whitespace-pre-line">{end || record.end || '—'}</span>
                  {end && state !== 'ended' && <span className="ml-2 whitespace-nowrap text-slate-500">D{remainingDays === 0 ? '‑day' : remainingDays > 0 ? `-${remainingDays}` : `+${Math.abs(remainingDays)}`}</span>}
                </td>
                <td className={cell}><span className={`rounded px-2 py-1 font-medium ${STATUS_STYLE[state]}`}>{text(state)}</span></td>
                <td className={cell}>{record.renewal || '—'}</td>
                <td className={cell}>{record.terminationUncertain ? text('check') : record.termination || '—'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">{text('noResults')}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const NORTH_WAREHOUSES = opsList('warehouses', '북부').filter(site => site.data?.['창고']);
const money = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);

function readPnl(site, month) {
  const warehouse = site.data['창고'];
  const index = month - 1;
  const covered = warehouse.coverage?.[OPS_CURRENT]?.[index];
  return Object.fromEntries(PNL_FIELDS.map(field => {
    const fieldCoverage = field === 'rental' ? warehouse.itemCoverage?.[RENTAL_ACCOUNT] : warehouse.fieldCoverage?.[field];
    const values = field === 'rental' ? warehouse.items?.[RENTAL_ACCOUNT] : warehouse[field];
    const amount = values?.[OPS_CURRENT]?.[index];
    return [field, covered && fieldCoverage?.[OPS_CURRENT]?.[index] && Number.isFinite(amount) ? amount : null];
  }));
}

function ContractAmountCell({ entries, type, text }) {
  const candidates = entries.filter(entry => entry.record.sheet === type && !['outside', 'inHouse'].includes(entry.status));
  const included = candidates.filter(entry => entry.status === 'included');
  return <td className={numberCell}>
    {included.length ? money(included.reduce((total, entry) => total + entry.amount, 0) / 1_000_000) : '—'}
    {candidates.length > 0 && <div className={`mt-1 whitespace-nowrap ${included.length < candidates.length ? 'text-amber-800' : 'text-slate-500'}`}>{text('confirmed')} {included.length}/{candidates.length}</div>}
  </td>;
}

export function WarehouseContractComparison({ tabs, onOpen }) {
  const text = useAnalysisLabels();
  const monthCount = opsActualCount(OPS_CURRENT);
  const [month, setMonth] = useState(monthCount);
  const [open, setOpen] = useState(null);
  const { bySite, unlinked } = useMemo(() => linkWarehouseContracts(tabs, NORTH_WAREHOUSES), [tabs]);
  const period = monthBounds(OPS_CURRENT, month);
  const rows = NORTH_WAREHOUSES.filter(site => bySite.has(site.name)).map(site => ({
    site,
    actual: readPnl(site, month),
    entries: bySite.get(site.name).map(record => ({ record, ...contractMonth(record, period) })),
  })).sort((a, b) => (b.actual.revenue ?? -Infinity) - (a.actual.revenue ?? -Infinity) || a.site.name.localeCompare(b.site.name));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          {text('compareMonth')}
          <select value={month} onChange={event => setMonth(Number(event.target.value))} className={filterStyle}>
            {Array.from({ length: monthCount }, (_, index) => index + 1).reverse().map(value => (
              <option key={value} value={value}>{OPS_CURRENT}-{String(value).padStart(2, '0')}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-3 text-xs text-slate-500"><span>{text('unit')}</span><a className="text-blue-700 underline" href={OPS_SOURCE.url}>{text('pnlSource')}</a></div>
      </div>
      <p className="max-w-4xl text-xs leading-relaxed text-slate-500">{text('compareNote')}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr><th rowSpan={2} scope="col" className={cell}>{text('warehouse')}</th><th colSpan={3} scope="colgroup" className={`${cell} bg-blue-50 text-center text-blue-900`}>{text('recordedAmounts')}</th><th colSpan={4} scope="colgroup" className={`${cell} text-center`}>{text('actual')}</th></tr>
            <tr>{[...TYPE_KEYS, ...PNL_FIELDS].map(key => <th scope="col" key={key} className={numberCell}>{text(key)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(({ site, actual, entries }) => (
              <Fragment key={site.name}>
                <tr className="border-t border-slate-100">
                  <th scope="row" className={cell}><button type="button" aria-expanded={open === site.name} className="text-left text-blue-800 hover:underline" onClick={() => setOpen(open === site.name ? null : site.name)}>{site.name.replace(/ \(북부\)$/, '')}</button></th>
                  {TYPE_KEYS.map(type => <ContractAmountCell key={type} entries={entries} type={type} text={text} />)}
                  {PNL_FIELDS.map(key => <td key={key} className={`${numberCell} ${actual[key] < 0 ? 'text-red-700' : ''}`}>{actual[key] === null ? '—' : money(actual[key])}</td>)}
                </tr>
                {open === site.name && <tr><td colSpan={8} className="border-t border-blue-100 bg-blue-50/30 px-3 py-3">
                  <div className="space-y-1.5"><p className="font-semibold">{text('sourceDetails')}</p>
                    {entries.map(({ record, status }) => <div key={record.id} className="grid grid-cols-4 gap-2 border-t border-slate-100 py-1.5">
                      <ContractName record={record} onOpen={onOpen} /><span>{text(record.sheet)}</span>
                      <span className="tabular-nums">{record.fee ? `${record.fee} VND` : '—'}</span><span>{text(status)}</span>
                    </div>)}
                  </div>
                </td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-slate-700">{text('unlinked')} {unlinked.length}</summary>
        <p className="my-2 text-slate-500">{text('unlinkedNote')}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {unlinked.map(record => <li key={record.id} className="border-t border-slate-100 py-1">
            <ContractName record={record} onOpen={onOpen} /><div className="text-slate-500">{text(record.sheet)} · {record.location || '—'}</div>
          </li>)}
        </ul>
      </details>
    </section>
  );
}
