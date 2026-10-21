import { localizeText, translateDisplay } from "../lib/i18n";
import { useState, useMemo } from 'react';
import {
  OPS_YEARS, OPS_CURRENT, opsActualCount, OPS_SOURCE,
  opsList, opsGet, view, periodOf, periodYoyOf, anomaliesOf, allAnomalies, itemRanking,
  inputState, averageOf,
} from '../lib/ops';
import EntityComparison from './EntityComparison';
import CumulativeComparison from './CumulativeComparison';
import IdentityReview from './IdentityReview';
import AnalysisAction from './AnalysisAction';
import { makeAnalysisPayload } from '../lib/analysisPayload';
import { formatSmallMoney, formatLargeMoney, smallMoneyLabel, largeMoneyLabel } from '../lib/currency';
import { useLang } from '../context/LangContext';

const REGIONS = ['전체', '북부', '남부', '미지정'];
const CLFFS = ['전체', 'CL', 'FF', '기타'];
const BIZS = ['전체', '운송', '창고'];
const eok = formatLargeMoney;
const mn = formatSmallMoney;
const pctTxt = (v) => v == null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const dcol = (v) => v == null ? 'text-slate-400' : v >= 0 ? 'text-blue-600' : 'text-red-500';

function Chip({ active, onClick, children }) {
  const { t } = useLang();
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
        ${active ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
      {typeof children === 'string' ? t(children) : children}
    </button>
  );
}
function FLabel({ ko }) {
  const { t } = useLang();
  return <span className="w-10 text-slate-400">{t(ko)}</span>;
}
function Card({ title, hint, children }) {
  const { t } = useLang();
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      {title && (
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">{t(title)}</span>
          {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export default function OpsExplorer({ kind, groupNoun }) {
  const { t } = useLang();
  const [year, setYear] = useState(OPS_CURRENT);
  const [month, setMonth] = useState(0);
  const periodLabel = translateDisplay(`${year}년 ${month ? `${month}월` : '누적'}`);
  const changeYear = (y) => { setYear(y); setMonth(0); setSel(null); if (Number(y) <= 2024) setRegion('전체'); };
  const [region, setRegion] = useState('북부');   // 북부 담당자 기본
  const [clff, setClff] = useState('전체');
  const [biz, setBiz] = useState('전체');
  const [sel, setSel] = useState(null);
  const [thr, setThr] = useState(30);
  const [query, setQuery] = useState('');
  const [selected,setSelected]=useState([]);
  const [selectionMessage,setSelectionMessage]=useState('');
  function toggleCompare(name){setSelectionMessage('');setSelected(current=>current.includes(name)?current.filter(n=>n!==name):current.length<5?[...current,name]:current);if(!selected.includes(name)&&selected.length>=5)setSelectionMessage('최대 5개까지 비교할 수 있습니다.');}
  const searchKey = query.trim().normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');

  const setClffR = (c) => { setClff(c); setBiz('전체'); setSel(null); setSelected([]); };
  const scope = [clff !== '전체' && t(clff), biz !== '전체' && t(biz), region !== '전체' && t(region)].filter(Boolean).join(' · ') || t('전체');

  // 엔티티 + 뷰 (필터 반영) , 매출순 정렬
  const rows = useMemo(() => opsList(kind, region, clff)
    .filter(e => !searchKey || [e.name,...(e.aliasNames||[]),...Object.values(e.data).flatMap(d=>d.sourceNames||[])].some(name=>name.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '').includes(searchKey)))
    .map((e) => ({ e, v: view(e, clff, biz) }))
    .filter(({ v }) => (month ? v.coverage?.[year]?.[month-1] : v.coverage?.[year]?.some(Boolean)) || ['revenue', 'directCost', 'grossProfit', 'opProfit'].some(f => month ? periodOf(v, f, year, month) !== 0 : (v[f]?.[year] || []).some(x => x !== 0)))
    .sort((a, b) => periodOf(b.v, 'revenue', year, month) - periodOf(a.v, 'revenue', year, month)),
    [kind, region, clff, biz, year, month, searchKey]);

  const anomalyCount = useMemo(() => {
    const map = {};
    for (const { e, v } of rows) map[e.name] = anomaliesOf(v, { threshold: thr / 100 }).filter(a => a.year === year && (!month || a.month === month)).length;
    return map;
  }, [rows, thr, year, month]);
  const topAnoms = useMemo(
    () => allAnomalies(kind, region, clff, biz, { threshold: thr / 100 }).filter(a => a.year === year && (!month || a.month === month) && (!searchKey || a.entity.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '').includes(searchKey))).slice(0, 8),
    [kind, region, clff, biz, thr, year, month, searchKey]);

  const selEntity = sel ? opsGet(kind, sel) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-800">{t(groupNoun)} <span className="text-sm font-normal text-slate-400">{OPS_YEARS.join('·')}</span></h1>
        <span className="text-xs text-slate-400">{year}{translateDisplay("년 ")}{opsActualCount(year)}{translateDisplay("월까지 실적 · 매출 ")}{largeMoneyLabel()}{translateDisplay(" · 원가 ")}{smallMoneyLabel()}</span>
      </div>

      <div className="flex gap-1.5 flex-wrap">{OPS_YEARS.map(y => <Chip key={y} active={year === y} onClick={() => changeYear(y)}>{y}{translateDisplay("년")}</Chip>)}</div>
      {<div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={translateDisplay('조회 월')}>
        <FLabel ko="월" />
        <Chip active={month === 0} onClick={() => setMonth(0)}>{translateDisplay('누적')}</Chip>
        {Array.from({ length: opsActualCount(year) }, (_, i) => i + 1).map(m => <Chip key={m} active={month === m} onClick={() => setMonth(m)}>{m}{translateDisplay('월')}</Chip>)}
      </div>}
      {Number(year) <= 2024 && <p className="text-xs text-amber-700">{translateDisplay("지역·세부 사업 구분이 누락된 연도입니다. 전체 기준으로 조회합니다.")}</p>}
      {/* 필터: 지역 / 사업 / (CL일 때) 구분 */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2 flex-wrap"><FLabel ko="지역" />
          {REGIONS.map((r) => <Chip key={r} active={region === r} onClick={() => { setRegion(r); setSel(null); setSelected([]); }}>{r}</Chip>)}</div>
        <div className="flex items-center gap-2 flex-wrap"><FLabel ko="사업" />
          {CLFFS.map((c) => <Chip key={c} active={clff === c} onClick={() => setClffR(c)}>{c}</Chip>)}</div>
        {clff === 'CL' && (
          <div className="flex items-center gap-2 flex-wrap"><FLabel ko="구분" />
            {BIZS.map((b) => <Chip key={b} active={biz === b} onClick={() => { setBiz(b); setSel(null); setSelected([]); }}>{b}</Chip>)}</div>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="flex gap-2">
          <input type="search" aria-label={kind === 'customers' ? '고객사명 검색' : '창고명 검색'} placeholder={kind === 'customers' ? '고객사명 입력 · 예: SAMSUNG' : '창고명 입력 · 예: AJ'} value={query} onChange={event => { setQuery(event.target.value); setSel(null); }} onKeyDown={event => { if (event.key === 'Enter' && rows.length === 1) setSel(rows[0].e.name); }} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-blue-500" />
          {query && <button className="shrink-0 text-sm text-slate-500" onClick={() => { setQuery(''); setSel(null); }}>초기화</button>}
        </div>
        {searchKey && <>
          <p role="status" className="text-xs text-slate-500">검색 결과 {rows.length}개 · 현재 필터 기준 · 선택하면 상세 분석</p>
          <div className="flex flex-wrap gap-2">{rows.slice(0, 10).map(({ e }) => <button key={e.name} onClick={() => setSel(e.name)} className={'rounded-lg border px-3 py-2 text-sm '+(sel === e.name ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50')}>{e.name}</button>)}</div>
          {!rows.length && <p className="text-xs text-slate-500">일치하는 실적이 없습니다. 이름 또는 지역·사업·연도 필터를 확인해주세요.</p>}
        </>}
      </div>
      <p className="text-xs text-slate-500">목록의 체크박스로 최대 5개를 선택해 비교할 수 있습니다. {selectionMessage}</p>
      <EntityComparison kind={kind} selected={selected} onRemove={toggleCompare} onClear={()=>setSelected([])} year={year} month={month} clff={clff} biz={biz} onPick={setSel}/>
      <IdentityReview kind={kind} region={region} clff={clff} biz={biz} year={year} month={month}/>
      <div className="text-[11px] text-slate-400">{translateDisplay("현재 보기: ")}<b className="text-slate-600">{scope} · {periodLabel}</b></div>
      <p className="text-[11px] text-slate-500">{translateDisplay("급증·0원 전환에는 창고·고객 명칭 변경이나 비용 이관도 포함될 수 있습니다. 실제 누락 여부는 원본 확인이 필요합니다.")}</p>

      {!selEntity && <OpsAlertCard kind={kind} scope={`${region}|${clff}|${biz}`} topAnoms={topAnoms} thr={thr} setThr={setThr} onPick={setSel} groupNoun={groupNoun} />}
      {!selEntity && <ProfitCard kind={kind} scope={`${region}|${clff}|${biz}`} month={month} year={year} rows={rows} groupNoun={groupNoun} onPick={setSel} />}

      {!selEntity
        ? <ListTable selected={selected} onCompare={toggleCompare} month={month} year={year} rows={rows} anomalyCount={anomalyCount} groupNoun={groupNoun} onPick={setSel} />
        : <Detail onCompare={toggleCompare} selected={selected} kind={kind} month={month} year={year} setYear={y => { setYear(y); setMonth(0); }} e={selEntity} clff={clff} biz={biz} thr={thr} groupNoun={groupNoun} onBack={() => setSel(null)} />}

      <p className="text-[11px] text-slate-400 text-center">{translateDisplay("출처: ")}{OPS_SOURCE?.title}{translateDisplay(" · 2023·2024년 지역·세부 사업 미지정 · 참고용, 원본과 교차확인 권장")}</p>
    </div>
  );
}

function OpsAlertCard({ kind, scope, topAnoms, thr, setThr, onPick, groupNoun }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-amber-50/70 rounded-xl border border-amber-100 p-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-amber-800">{translateDisplay(" ⚠️ 원가 급변 점검 ")}{topAnoms.length ? translateDisplay(`· ${topAnoms.length}건+`) : '· 없음'} {open ? '' : '(펼치기)'}
        </button>
        <label className="text-[11px] text-amber-700 flex items-center gap-1">{translateDisplay(" 전월비 임계 ")}<input type="range" min="20" max="80" step="5" value={thr} onChange={(e) => setThr(+e.target.value)} className="w-20 accent-amber-600" /> <b>±{thr}%</b>
        </label>
      </div>
      {open && (
        <div className="mt-2 space-y-1">
          {topAnoms.length === 0 && <div className="text-[12px] text-amber-700">{formatSmallMoney(100)} {smallMoneyLabel()}{translateDisplay(" 이상 변동 없음.")}</div>}
          {topAnoms.map((a, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><button onClick={() => onPick(a.entity)}
              className="flex flex-wrap sm:flex-nowrap min-w-0 items-center gap-2 w-full text-left text-[12px] hover:bg-amber-100/60 rounded px-1.5 py-1">
              <span className={`font-bold tabular-nums shrink-0 ${a.delta >= 0 ? 'text-red-500' : 'text-blue-600'}`}>{a.delta >= 0 ? '▲' : '▼'}{a.chg == null ? '신규' : Math.abs(a.chg * 100).toFixed(0) + '%'}</span>
              <span className="font-medium text-slate-700 truncate">{a.entity}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 truncate">{a.item.replace(/^\d+\.\s*/, '')}</span>
              <span className="text-slate-400 shrink-0">{a.year.slice(2)}.{a.month}</span>
              <span className="text-slate-400 ml-auto tabular-nums shrink-0">{mn(a.prev)}→{a.inputState==='noRows'?'행 없음':a.inputState==='missingValue'?'미입력':mn(a.cur)}</span>
            </button><AnalysisAction payload={makeAnalysisPayload({source:OPS_SOURCE,kind,entity:a.entity,item:a.item,scope,period:{by:a.year,bm:[a.month-2],cy:a.year,cm:[a.month-1]},reason:'cost',title:`${a.entity} · ${a.item} 원가 변동 확인`,evidence:`${a.year}년 ${a.month-1}→${a.month}월 · ${mn(a.prev)} → ${a.inputState==='noRows'?'행 없음':a.inputState==='missingValue'?'미입력':mn(a.cur)} ${smallMoneyLabel()} · 원본 입력 상태 ${a.inputState==='noRows'?'실적 행 없음':a.inputState==='missingValue'?'미입력':'입력 있음'}`,impact:`변동 ${mn(a.delta)} ${smallMoneyLabel()}`,question:'원본 금액과 명칭·배부 변경, 실제 운영 변동 여부를 확인해주세요.',facts:a})}/></div>
          ))}
          <div className="text-[10px] text-amber-600/80 pt-0.5">{translateDisplay("변동액 ")}{formatSmallMoney(100)} {smallMoneyLabel()}{translateDisplay(" 이상 + 전월비 ±")}{thr}{translateDisplay("% 이상. 클릭 → 해당 ")}{groupNoun}{translateDisplay(" 상세.")}</div>
        </div>
      )}
    </div>
  );
}

/* 수익성 점검 — 적자/저마진 Top (현재 필터 기준) */
function ProfitCard({ kind, scope, month, year, rows, groupNoun, onPick }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(true);
  const ranked = rows.map(({ e, v }) => {
    const rev = periodOf(v, 'revenue', year, month);
    const op = periodOf(v, 'opProfit', year, month);
    const gp = periodOf(v, 'grossProfit', year, month);
    return { name: e.name, region: e.region, rev, op, opM: rev ? (op / rev) * 100 : null, gpM: rev ? (gp / rev) * 100 : null };
  }).filter((x) => x.rev > 0)
    .sort((a, b) => a.opM - b.opM)            // 영업이익률 낮은 순
    .slice(0, 8);
  if (!ranked.length) return null;
  return (
    <div className="bg-rose-50/60 rounded-xl border border-rose-100 p-3">
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-rose-800">
        🩺 {localizeText('수익성 점검', 'Profitability watch', lang)} · {localizeText('영업이익률 낮은 순', 'lowest OP margin', lang)} {open ? '' : '(펼치기)'}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-rose-400/80 text-[11px] border-b border-rose-100">
                <th className="text-left font-medium px-2 py-1.5">{t(groupNoun)}</th>
                <th className="text-right font-medium px-2 py-1.5 whitespace-nowrap">{localizeText(`매출 ${largeMoneyLabel()}`, `Rev ${largeMoneyLabel()}`, lang)}</th>
                <th className="text-right font-medium px-2 py-1.5 whitespace-nowrap">{localizeText(`영업이익 ${smallMoneyLabel()}`, `OP ${smallMoneyLabel()}`, lang)}</th>
                <th className="text-right font-medium px-2 py-1.5">{localizeText('영업이익률', 'OP%', lang)}</th>
                <th className="text-right font-medium px-2 py-1.5">{localizeText('매출이익률', 'GP%', lang)}</th><th className="px-2 py-1.5">조치</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((x) => (
                <tr key={x.name} onClick={() => onPick(x.name)} className="border-b border-rose-50/70 last:border-0 cursor-pointer hover:bg-rose-100/40">
                  <td className="text-left px-2 py-1.5 font-medium text-slate-700 whitespace-nowrap">{x.name}<span className="text-[10px] text-slate-400 ml-1">{x.region}</span></td>
                  <td className="text-right px-2 py-1.5 tabular-nums text-slate-600">{eok(x.rev)}</td>
                  <td className={`text-right px-2 py-1.5 tabular-nums ${x.op < 0 ? 'text-red-500 font-semibold' : 'text-slate-600'}`}>{mn(x.op)}</td>
                  <td className={`text-right px-2 py-1.5 tabular-nums font-semibold ${x.opM < 0 ? 'text-red-500' : x.opM < 3 ? 'text-amber-600' : 'text-emerald-600'}`}>{x.opM == null ? '-' : x.opM.toFixed(1) + '%'}</td>
                  <td className={`text-right px-2 py-1.5 tabular-nums ${x.gpM < 0 ? 'text-red-500' : 'text-slate-500'}`}>{x.gpM == null ? '-' : x.gpM.toFixed(1) + '%'}</td>
                  <td className="px-2 py-1.5" onClick={e=>e.stopPropagation()}><AnalysisAction payload={makeAnalysisPayload({source:OPS_SOURCE,kind,entity:x.name,item:'영업이익',scope,period:`${year}:${month||'YTD'}`,reason:'profitability',title:`${x.name} 수익성 확인`,evidence:`${year}년 ${month?month+'월':'누계'} · 매출 ${eok(x.rev)} ${largeMoneyLabel()} · 영업이익 ${mn(x.op)} ${smallMoneyLabel()} · 영업이익률 ${x.opM==null?'—':x.opM.toFixed(1)+'%'}`,question:'계약 조건, 물량, 단가와 비용 배부를 확인하고 개선 조치를 결정해주세요.',facts:x})}/></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[10px] text-rose-600/70 pt-1">{localizeText('빨강=적자, 주황=영업이익률 3% 미만. 클릭 → 상세.', 'Red = loss, amber = OP margin < 3%. Click to drill.', lang)}</div>
        </div>
      )}
    </div>
  );
}

function ListTable({ selected, onCompare, month, year, rows, anomalyCount, groupNoun, onPick }) {
  const { t, lang } = useLang();
  const U = (ko, en) => (localizeText(ko, en, lang));
  return (
    <Card title={`${t(groupNoun)} · ${translateDisplay(`${year}년 ${month ? `${month}월` : '누적'}`)}`} hint={`${rows.length}`}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="px-2 py-2">비교</th><th className="text-left font-medium px-2.5 py-2 sticky left-0 bg-white">{t(groupNoun)}</th>
              <th className="text-right font-medium px-2.5 py-2 whitespace-nowrap leading-tight">{U('매출', 'Revenue')}<span className="block text-[8px] text-slate-300">{U(`${largeMoneyLabel()}`, `${largeMoneyLabel()}`)}</span></th>
              <th className="text-right font-medium px-2.5 py-2">{U('전년비', 'YoY')}</th>
              <th className="text-right font-medium px-2.5 py-2 whitespace-nowrap leading-tight">{U('직접원가', 'Direct Cost')}<span className="block text-[8px] text-slate-300">{U(`${largeMoneyLabel()}`, `${largeMoneyLabel()}`)}</span></th>
              <th className="text-right font-medium px-2.5 py-2 whitespace-nowrap leading-tight">{U('매출이익', 'Gross Profit')}<span className="block text-[8px] text-slate-300">{U(`${smallMoneyLabel()}`, `${smallMoneyLabel()}`)}</span></th>
              <th className="text-right font-medium px-2.5 py-2">{U('이익률', 'Margin')}</th>
              <th className="text-center font-medium px-2 py-2">{U('점검', 'Check')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-center text-slate-400">{translateDisplay('선택한 기간·조건의 실적이 없습니다.')}</td></tr>}
            {rows.map(({ e, v }) => {
              const rev = periodOf(v, 'revenue', year, month);
              const dc = periodOf(v, 'directCost', year, month);
              const gp = periodOf(v, 'grossProfit', year, month);
              const mgn = rev ? (gp / rev) * 100 : null;
              const yv = periodYoyOf(v, 'revenue', year, month);
              const ac = anomalyCount[e.name] || 0;
              return (
                <tr key={e.name} onClick={() => onPick(e.name)}
                  className="border-b border-slate-50 last:border-0 cursor-pointer hover:bg-blue-50/50">
                  <td className="px-2 py-2" onClick={event=>event.stopPropagation()}><input type="checkbox" aria-label={`${e.name} 비교 선택`} checked={selected.includes(e.name)} onChange={()=>onCompare(e.name)}/></td>
                  <td className="text-left px-2.5 py-2 font-medium text-slate-700 sticky left-0 bg-white whitespace-nowrap">
                    {e.name}<span className="text-[10px] text-slate-400 ml-1">{e.region}{e.segs?.length ? '·' + e.segs.join('/') : ''}</span>
                  </td>
                  <td className="text-right px-2.5 py-2 tabular-nums font-semibold text-slate-800">{eok(rev)}</td>
                  <td className={`text-right px-2.5 py-2 tabular-nums ${dcol(yv)}`}>{pctTxt(yv)}</td>
                  <td className="text-right px-2.5 py-2 tabular-nums text-slate-500">{eok(dc)}</td>
                  <td className={`text-right px-2.5 py-2 tabular-nums ${gp < 0 ? 'text-red-500' : 'text-slate-600'}`}>{mn(gp)}</td>
                  <td className={`text-right px-2.5 py-2 tabular-nums ${mgn < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{mgn == null ? '-' : mgn.toFixed(1) + '%'}</td>
                  <td className="text-center px-2 py-2">{ac > 0 ? <span className="text-[11px] font-bold text-amber-600">⚠{ac}</span> : <span className="text-slate-200">·</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Detail({ onCompare, selected, kind, month, year, setYear, e, clff, biz, thr, groupNoun, onBack }) {
  const { t } = useLang();
  const [bizD, setBizD] = useState(biz);   // 상세 내 운송/창고 재선택
  const v = useMemo(() => view(e, clff === 'FF' ? 'FF' : clff, clff === 'CL' ? bizD : '전체'), [e, clff, bizD]);
  const n = opsActualCount(year);
  const flags = useMemo(() => {
    const set = {};
    for (const a of anomaliesOf(v, { threshold: thr / 100 })) set[`${a.year}|${a.item}|${a.month}`] = a.delta;
    return set;
  }, [v, thr]);
  const ranked = month ? Object.keys(v.items || {}).map(item => ({ item, total: periodOf({ [item]: v.items[item] }, item, year, month) })).filter(x => x.total !== 0).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)) : itemRanking(v, year);

  const PL = [
    { k: 'revenue', label: '매출', f: eok, unit: largeMoneyLabel(), bold: true },
    { k: 'directCost', label: '직접원가', f: eok, unit: largeMoneyLabel() },
    { k: 'directProfit', label: '직접이익', f: mn, unit: smallMoneyLabel() },
    { k: 'indirectCost', label: '간접원가', f: mn, unit: smallMoneyLabel() },
    { k: 'grossProfit', label: '매출이익', f: mn, unit: smallMoneyLabel() },
    { k: 'opProfit', label: '영업이익', f: mn, unit: smallMoneyLabel(), bold: true },
  ];
  const months = month ? [month - 1] : Array.from({ length: 12 }, (_, i) => i);
  const segAvail = clff === 'CL';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onBack} className="text-sm text-blue-600 font-medium">‹ {t(groupNoun)}</button>
        <h2 className="text-base font-bold text-slate-800">{e.name}</h2><button className="rounded-lg border px-2 py-1 text-xs text-blue-700" onClick={()=>onCompare(e.name)}>{selected.includes(e.name)?'비교 해제':'비교 추가'}</button><AnalysisAction payload={makeAnalysisPayload({source:OPS_SOURCE,kind,entity:e.name,item:'실적',scope:`${e.region}|${clff}|${bizD}`,period:`${year}:${month||'YTD'}`,reason:'entity',title:`${e.name} 실적 확인`,evidence:`${year}년 ${month?month+'월':'누계'} · 매출 ${eok(periodOf(v,'revenue',year,month))} ${largeMoneyLabel()} · 영업이익 ${mn(periodOf(v,'opProfit',year,month))} ${smallMoneyLabel()}`,question:'실적 변동의 원인과 필요한 후속조치를 확인해주세요.'})}/>
        <span className="text-[11px] text-slate-400">{e.region}{e.segs?.length ? ' · ' + e.segs.join('/') : ''}</span>
        <div className="ml-auto flex gap-1">
          {OPS_YEARS.map((y) => <Chip key={y} active={year === y} onClick={() => setYear(y)}>{y.slice(2)}{translateDisplay("년")}</Chip>)}
        </div>
      </div>

      <p className="text-xs text-slate-500">원본 이름: {[...new Set(Object.values(e.data).flatMap(d=>d.sourceNames||[]))].join(' / ')}{e.aliasNames?.length?kind==='customers'?' · 확인된 동일 고객사로 연결':' · 확인된 동일 거점으로 연결':''}</p>
      {segAvail && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-400">{t('구분')}</span>
          {BIZS.map((b) => <Chip key={b} active={bizD === b} onClick={() => setBizD(b)}>{b}</Chip>)}
        </div>
      )}

      <CumulativeComparison v={v} year={year} month={month}/>
      <p className="text-xs text-slate-500">{translateDisplay('월평균 = 입력 월 합계 ÷ 입력 개월 · 입력 0 포함 · 미입력·행 없음 제외')}</p>
      <Card title={translateDisplay("월별 손익")} hint={translateDisplay(`${year}년${month ? ` ${month}월` : ''}${clff === 'CL' && bizD !== '전체' ? ' · ' + bizD : ''}`)}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="text-sm min-w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-100">
                <th className="text-left font-medium px-2.5 py-2 sticky left-0 bg-white">{translateDisplay("항목")}</th>
                {months.map((i) => <th key={i} className={`text-right font-medium px-2 py-2 ${i >= n ? 'text-slate-200' : ''}`}>{i + 1}{translateDisplay("월")}</th>)}
                <th className="text-right font-medium px-2.5 py-2 bg-slate-50">{translateDisplay(month ? '선택 월' : '누계')}</th>
                <th className="text-right font-medium px-2.5 py-2 bg-blue-50 whitespace-nowrap">{translateDisplay('월평균')}</th>
              </tr>
            </thead>
            <tbody>
              {PL.map((row) => {
                const s = v[row.k]?.[year] || [];
                return (
                  <tr key={row.k} className="border-b border-slate-50 last:border-0">
                    <td className={`text-left px-2.5 py-2 sticky left-0 bg-white whitespace-nowrap ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                      {t(row.label)}<span className="text-[9px] text-slate-400 ml-1">{row.unit}</span>
                    </td>
                    {months.map((i) => {
                      const x = s[i] || 0;
                      return <td key={i} className={`text-right px-2 py-2 tabular-nums whitespace-nowrap ${i >= n ? 'text-slate-200' : x < 0 ? 'text-red-500' : 'text-slate-700'}`}>{i>=n?'미집계':!v.coverage?.[year]?.[i]?'행 없음':!v.fieldCoverage?.[row.k]?.[year]?.[i]?'미입력':row.f(x)}</td>;
                    })}
                    <td className="text-right px-2.5 py-2 tabular-nums font-bold text-slate-800 bg-slate-50">{row.f(periodOf(v, row.k, year, month))}</td>
                    <td className="text-right px-2.5 py-2 tabular-nums font-semibold text-blue-800 bg-blue-50">{averageOf(v,row.k,year,month)==null?'—':row.f(averageOf(v,row.k,year,month))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={translateDisplay("원가 항목 월별 모니터")} hint={translateDisplay(`${year}년${month ? ` ${month}월` : ''} · 빨강=급증 파랑=급감 (100 mil↑ ±${thr}%)`)}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="text-sm min-w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-100">
                <th className="text-left font-medium px-2.5 py-2 sticky left-0 bg-white whitespace-nowrap">{translateDisplay("원가 항목")}<span className="block text-[9px] text-slate-300">{smallMoneyLabel()}</span></th>
                {months.map((i) => <th key={i} className={`text-right font-medium px-2 py-2 ${i >= n ? 'text-slate-200' : ''}`}>{i + 1}{translateDisplay("월")}</th>)}
                <th className="text-right font-medium px-2.5 py-2 bg-slate-50">{translateDisplay(month ? '선택 월' : '누계')}</th>
                <th className="text-right font-medium px-2.5 py-2 bg-blue-50 whitespace-nowrap">{translateDisplay('월평균')}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ item }) => {
                const s = v.items?.[item]?.[year] || [];
                return (
                  <tr key={item} className="border-b border-slate-50 last:border-0">
                    <td className="text-left px-2.5 py-2 text-slate-600 sticky left-0 bg-white whitespace-nowrap">{item}</td>
                    {months.map((i) => {
                      const x = s[i] || 0;
                      const fd = flags[`${year}|${item}|${i + 1}`];
                      const flagged = fd != null;
                      return (
                        <td key={i} className={`text-right px-2 py-2 tabular-nums whitespace-nowrap relative
                          ${i >= n ? 'text-slate-200' : flagged ? (fd >= 0 ? 'bg-red-50 text-red-600 font-semibold' : 'bg-blue-50 text-blue-600 font-semibold') : 'text-slate-600'}`}>
                          {flagged && <span className="absolute left-0.5 top-1.5 text-[9px]">{fd >= 0 ? '▲' : '▼'}</span>}
                          {i>=n?'미집계':inputState(v,year,[i],item)==='noRows'?'행 없음':inputState(v,year,[i],item)==='missingValue'?'미입력':mn(x)}
                        </td>
                      );
                    })}
                    <td className="text-right px-2.5 py-2 tabular-nums font-semibold text-slate-700 bg-slate-50">{mn(periodOf({ [item]: v.items?.[item] }, item, year, month))}</td>
                    <td className="text-right px-2.5 py-2 tabular-nums font-semibold text-blue-800 bg-blue-50">{averageOf(v,item,year,month,true)==null?'—':mn(averageOf(v,item,year,month,true))}</td>
                  </tr>
                );
              })}
              {ranked.length === 0 && <tr><td className="px-3 py-4 text-center text-slate-400 text-sm" colSpan={months.length + 3}>{translateDisplay("원가 데이터가 없습니다.")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-slate-400 mt-1.5">{translateDisplay("큰 항목 순 · 셀 색칠 = 전월비 ±")}{thr}{translateDisplay("% 이상이며 변동액 ")}{formatSmallMoney(100)} {smallMoneyLabel()}{translateDisplay(" 초과 → 운영팀 점검 대상")}</div>
      </Card>
    </div>
  );
}
