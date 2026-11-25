import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Search } from 'lucide-react';
import { getRedirectResult, signInWithRedirect } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { buildContractRegister } from '../lib/contracts';
import { auth, db, googleProvider } from '../lib/firebase';
import { useDecisionLinks } from '../context/DecisionLinkContext';
import { useLang } from '../context/LangContext';
import { RenewalReview, WarehouseContractComparison } from '../components/ContractAnalysis';

const COPY = {
  title: ['계약 정보', 'Contracts', 'Hợp đồng'],
  WH: ['창고 임대', 'Warehouse leases', 'Thuê kho'],
  CUSTOMER: ['고객사', 'Customers', 'Khách hàng'],
  'WH Vendor': ['창고 운영 벤더', 'Warehouse vendors', 'Nhà cung cấp kho'],
  source: ['원본 시트', 'Source sheet', 'Bảng tính nguồn'],
  checked: ['확인', 'Checked', 'Đã kiểm tra'],
  refresh: ['요청 시 갱신', 'Updated on request', 'Cập nhật khi yêu cầu'],
  search: ['이름·창고·계약 내용 검색', 'Search name, warehouse or terms', 'Tìm tên, kho hoặc điều khoản'],
  all: ['전체', 'All', 'Tất cả'],
  review: ['원본 확인 필요', 'Source review needed', 'Cần kiểm tra nguồn'],
  name: ['계약 대상', 'Contract party', 'Đối tác hợp đồng'],
  location: ['창고·위치', 'Warehouse / location', 'Kho / vị trí'],
  fee: ['월 금액 (VND)', 'Monthly amount (VND)', 'Số tiền tháng (VND)'],
  period: ['현재 계약기간', 'Current contract period', 'Thời hạn hiện tại'],
  renewal: ['자동갱신', 'Auto renewal', 'Tự gia hạn'],
  termination: ['해지 사전통보', 'Termination notice', 'Báo trước chấm dứt'],
  contact: ['담당자', 'Contact', 'Người phụ trách'],
  empty: ['미기입', 'Not entered', 'Chưa nhập'],
  noResults: ['검색 결과가 없습니다.', 'No results.', 'Không có kết quả.'],
  detail: ['계약 상세', 'Contract details', 'Chi tiết hợp đồng'],
  dates: ['####·수식 오류·날짜·열 위치는 원본 확인이 필요합니다.', 'Hash placeholders, formula errors, dates and column placement need source review.', 'Cần kiểm tra các ký hiệu ####, lỗi công thức, ngày và vị trí cột trong nguồn.'],
  shifted: ['고객사 R~AG열은 제목·내용 불일치 또는 제목 누락이 있어 원본 열 문자와 확인 표시를 붙였습니다. 해지 통보는 상세 원본을 확인해 주세요.', 'Customer columns R–AG have mismatched or missing headers. Column letters and review flags are shown. Check termination notice in the source details.', 'Các cột R–AG có tiêu đề không khớp hoặc thiếu. Hiển thị ký tự cột và dấu cần kiểm tra. Xem báo trước chấm dứt trong chi tiết nguồn.'],
  currency: ['계약 금액·단가는 원본 VND 기준', 'Contract amounts and rates use source VND', 'Số tiền và đơn giá theo VND nguồn'],
  loading: ['계약 자료 확인 중…', 'Checking contract access…', 'Đang kiểm tra quyền xem hợp đồng…'],
  signIn: ['Google로 시작', 'Continue with Google', 'Đăng nhập Google'],
  signInHint: ['허용된 Google 계정으로 계약 자료를 볼 수 있습니다.', 'Use an authorized Google account to view contracts.', 'Dùng tài khoản Google được cấp quyền để xem hợp đồng.'],
  signInFailed: ['Google 로그인에 실패했습니다. 다시 시도해 주세요.', 'Google sign-in failed. Try again.', 'Đăng nhập Google thất bại. Vui lòng thử lại.'],
  denied: ['이 Google 계정은 계약 자료 열람 권한이 없습니다.', 'This Google account cannot access the contracts.', 'Tài khoản Google này không có quyền xem hợp đồng.'],
  failed: ['계약 자료를 불러오지 못했습니다.', 'Could not load the contracts.', 'Không thể tải hợp đồng.'],
  retry: ['다시 시도', 'Try again', 'Thử lại'],
  register: ['계약 목록', 'Contract register', 'Danh sách hợp đồng'],
  renewalReview: ['만료·갱신 검토', 'Expiry & renewal review', 'Rà soát hết hạn và gia hạn'],
  warehousePnl: ['창고별 계약·손익', 'Contracts & P&L by warehouse', 'Hợp đồng và P&L theo kho'],
  back: ['검토 화면으로 돌아가기', 'Back to review', 'Quay lại màn hình rà soát'],
};

export default function ContractPage() {
  const { user } = useDecisionLinks();
  return <ContractAccess key={user?.uid ?? 'signed-out'} user={user} />;
}

function ContractAccess({ user }) {
  const { lang } = useLang();
  const text = key => COPY[key][{ ko: 0, en: 1, vi: 2 }[lang] ?? 0];
  const [register, setRegister] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [signInError, setSignInError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getRedirectResult(auth).catch(() => { if (active) setSignInError(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    getDocFromServer(doc(db, 'contractRegisters', 'warehouse')).then(snapshot => {
      if (active) setRegister(buildContractRegister(JSON.parse(snapshot.data()?.snapshot)));
    }).catch(error => {
      if (active) setLoadError(error.code === 'permission-denied' ? 'denied' : 'failed');
    });
    return () => { active = false; };
  }, [user, attempt]);

  async function signIn() {
    setSigningIn(true);
    setSignInError(false);
    try { await signInWithRedirect(auth, googleProvider); }
    catch { setSignInError(true); setSigningIn(false); }
  }

  if (register) return <ContractRegister register={register} />;
  return (
    <section className="space-y-3 rounded-xl bg-white p-6">
      <h1 className="text-lg font-bold text-slate-800">{text('title')}</h1>
      <p role="status" className="text-sm text-slate-600">
        {text(loadError || (user === null ? 'signInHint' : 'loading'))}
      </p>
      {user === null && <button disabled={signingIn} onClick={signIn} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">{text('signIn')}</button>}
      {user === null && signInError && <p role="alert" className="text-sm text-red-700">{text('signInFailed')}</p>}
      {loadError === 'failed' && <button onClick={() => { setLoadError(''); setAttempt(value => value + 1); }} className="rounded-lg border px-3 py-2 text-sm">{text('retry')}</button>}
    </section>
  );
}

function ContractRegister({ register: { source: contractSource, tabs: contractTabs } }) {
  const { lang, tf } = useLang();
  const [tab, setTab] = useState('WH');
  const [query, setQuery] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [open, setOpen] = useState(null);
  const [view, setView] = useState('register');
  const [returnView, setReturnView] = useState(null);
  const backButton = useRef(null);
  const viewButtons = useRef({});
  const focusView = useRef(false);
  useEffect(() => {
    if (returnView) backButton.current?.focus();
    else if (focusView.current) {
      focusView.current = false;
      viewButtons.current[view]?.focus();
    }
  }, [view, returnView]);
  const languageIndex = { ko: 0, en: 1, vi: 2 }[lang] ?? 0;
  const text = key => COPY[key][languageIndex];
  const cfg = contractTabs.find(item => item.id === tab);
  const reviewCount = cfg.records.filter(record => record.needsReview).length;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const rows = cfg.records.filter(record =>
    (!returnView || record.id === open) &&
    (!reviewOnly || record.needsReview) &&
    (!normalizedQuery || Object.values(record.values).some(value => value.toLocaleLowerCase().includes(normalizedQuery)))
  );
  const display = value => value?.trim() || text('empty');
  function openContract(record) {
    setReturnView(view);
    setView('register');
    setQuery('');
    setReviewOnly(false);
    setTab(record.sheet);
    setOpen(record.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-800">{text('title')}</h1>
        <a href={contractSource.url} className="inline-flex items-center gap-1 text-sm text-blue-700 underline">
          {text('source')} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <p className="text-xs text-slate-500">{contractSource.title} · {text('checked')} {contractSource.checkedAt} · {text('refresh')}</p>
      <div role="group" aria-label={text('title')} className="flex flex-wrap gap-2">
        {['register', 'renewalReview', 'warehousePnl'].map(key => (
          <button key={key} type="button" aria-pressed={view === key}
            ref={element => { viewButtons.current[key] = element; }}
            onClick={() => { setView(key); setReturnView(null); }}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${view === key ? 'border-blue-800 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600'}`}>
            {text(key)}
          </button>
        ))}
      </div>
      <div hidden={view !== 'renewalReview'}><RenewalReview tabs={contractTabs} onOpen={openContract} /></div>
      <div hidden={view !== 'warehousePnl'}><WarehouseContractComparison tabs={contractTabs} onOpen={openContract} /></div>
      <div hidden={view !== 'register'} className="space-y-4">
      {returnView ? (
        <button ref={backButton} type="button" onClick={() => { focusView.current = true; setView(returnView); setReturnView(null); }} className="text-sm font-semibold text-blue-700 hover:underline">← {text('back')}</button>
      ) : <>
      <div role="group" aria-label={text('title')} className="flex flex-wrap gap-2">
        {contractTabs.map(item => (
          <button key={item.id} onClick={() => { setTab(item.id); setOpen(null); }} aria-pressed={tab === item.id}
            className={`rounded-full px-3.5 py-2 text-sm font-medium ${tab === item.id ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
            {text(item.id)} <span className="opacity-70">{item.records.length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={event => { setQuery(event.target.value); setOpen(null); }} aria-label={text('search')} placeholder={text('search')}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        {reviewCount > 0 && <button onClick={() => { setReviewOnly(!reviewOnly); setOpen(null); }} aria-pressed={reviewOnly}
          className={`rounded-xl border px-3 py-2 text-xs ${reviewOnly ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>
          {text('review')} {reviewCount}
        </button>}
        {(query || reviewOnly) && <button className="px-2 text-xs text-blue-700 underline" onClick={() => { setQuery(''); setReviewOnly(false); setOpen(null); }}>{text('all')}</button>}
      </div>
      {reviewCount > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        {text('dates')}{tab === 'CUSTOMER' && <p className="mt-1">{text('shifted')}</p>}
      </div>}
      <div className="flex justify-between gap-2 text-xs text-slate-500"><span>{rows.length} / {cfg.records.length}</span><span>{text('currency')}</span></div>
      </>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1050px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>{['name', 'location', 'fee', 'period', 'renewal', 'termination', 'contact'].map(key => <th key={key} className="px-3 py-3 font-semibold">{text(key)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-slate-500">{text('noResults')}</td></tr>}
            {rows.map(record => {
              const isOpen = open === record.id;
              const Icon = isOpen ? ChevronDown : ChevronRight;
              return (
                <Fragment key={record.id}>
                  <tr className="border-t border-slate-100 align-top hover:bg-slate-50">
                    <td className="max-w-[240px] px-3 py-3">
                      {returnView ? <span className="font-semibold text-slate-800">{record.name}</span> :
                      <button onClick={() => setOpen(isOpen ? null : record.id)} aria-expanded={isOpen} aria-controls={`detail-${record.id}`} className="flex items-start gap-1.5 text-left font-semibold text-blue-800">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{record.name}</span>
                      </button>}
                      {record.entity && <div className="ml-5 mt-1 text-slate-500">{record.entity}</div>}
                      {record.scope && <div className="ml-5 mt-1 whitespace-pre-line text-slate-500">{record.scope}</div>}
                      {record.notes && <div className="ml-5 mt-1 whitespace-pre-line text-amber-800">{record.notes}</div>}
                      {record.needsReview && <div className="ml-5 mt-1 text-amber-700">{text('review')}</div>}
                    </td>
                    <td className="max-w-[180px] whitespace-pre-line break-words px-3 py-3">{display(record.location)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">{display(record.fee)}</td>
                    <td className="min-w-[160px] max-w-[220px] whitespace-pre-line px-3 py-3"><div>{display(record.start)}</div><div className="mt-1 text-slate-500">~ {display(record.end)}</div></td>
                    <td className="max-w-[150px] whitespace-pre-line px-3 py-3">{display(record.renewal)}</td>
                    <td className={`max-w-[160px] whitespace-pre-line px-3 py-3 ${record.terminationUncertain ? 'text-amber-800' : ''}`}>{record.terminationUncertain ? text('review') : display(record.termination)}</td>
                    <td className="whitespace-pre-line px-3 py-3">{display(record.contact)}</td>
                  </tr>
                  {isOpen && <tr id={`detail-${record.id}`}><td colSpan={7} className="border-t border-blue-100 bg-blue-50/30 px-4 py-4">
                    <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold text-slate-800">{record.name} · {text('detail')}</h2><a href={record.sourceUrl} className="text-blue-700 underline">{record.sheet} · {record.rows[0].row}–{record.rows.at(-1).row} ↗</a></div>
                    <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                      {record.fields.map(field => <div key={field.column} className="min-w-0 border-b border-slate-200 py-2">
                        <dt className={`mb-1 font-semibold ${field.uncertain ? 'text-amber-800' : 'text-slate-500'}`}>{field.column} · {tf(field.header)}{field.uncertain ? ` · ${text('review')}` : ''}</dt>
                        <dd className="space-y-1 text-slate-800">{field.values.map(cell => <div key={cell.row} className="whitespace-pre-wrap break-words"><span className="mr-2 text-[10px] text-slate-400">{field.column}{cell.row}</span>{cell.value}</div>)}</dd>
                      </div>)}
                    </dl>
                  </td></tr>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
