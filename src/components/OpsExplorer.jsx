import { useState, useMemo } from 'react';
import {
  OPS_YEARS, OPS_CURRENT, opsActualCount,
  opsList, opsGet, view, annualOf, ytdOf, yoyOf, anomaliesOf, allAnomalies, itemRanking,
} from '../lib/ops';
import { useLang } from '../context/LangContext';

const REGIONS = ['전체', '북부', '남부'];
const CLFFS = ['전체', 'CL', 'FF'];
const BIZS = ['전체', '운송', '창고'];
const eok = (mn) => mn == null ? '-' : (mn / 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const mn = (v) => v == null ? '-' : Math.round(v).toLocaleString('ko-KR');
const pctTxt = (v) => v == null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const dcol = (v) => v == null ? 'text-slate-400' : v >= 0 ? 'text-blue-600' : 'text-red-500';

function Chip({ active, onClick, children }) {
  const { t } = useLang();
  return (
    <button onClick={onClick}
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
  const [region, setRegion] = useState('북부');   // 북부 담당자 기본
  const [clff, setClff] = useState('전체');
  const [biz, setBiz] = useState('전체');
  const [sel, setSel] = useState(null);
  const [thr, setThr] = useState(30);

  const setClffR = (c) => { setClff(c); setBiz('전체'); setSel(null); };
  const scope = [clff !== '전체' && t(clff), biz !== '전체' && t(biz), region !== '전체' && t(region)].filter(Boolean).join(' · ') || t('전체');

  // 엔티티 + 뷰 (필터 반영) , 매출순 정렬
  const rows = useMemo(() => opsList(kind, region, clff)
    .map((e) => ({ e, v: view(e, clff, biz) }))
    .sort((a, b) => annualOf(b.v, 'revenue', OPS_CURRENT) - annualOf(a.v, 'revenue', OPS_CURRENT)),
    [kind, region, clff, biz]);

  const anomalyCount = useMemo(() => {
    const map = {};
    for (const { e, v } of rows) map[e.name] = anomaliesOf(v, { threshold: thr / 100 }).length;
    return map;
  }, [rows, thr]);
  const topAnoms = useMemo(
    () => allAnomalies(kind, region, clff, biz, { threshold: thr / 100 }).slice(0, 8),
    [kind, region, clff, biz, thr]);

  const selEntity = sel ? opsGet(kind, sel) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-800">{t(groupNoun)} <span className="text-sm font-normal text-slate-400">{OPS_YEARS.join('·')}</span></h1>
        <span className="text-xs text-slate-400">{OPS_CURRENT}년 {opsActualCount(OPS_CURRENT)}월까지 실적 · 매출 억동/원가 백만동</span>
      </div>

      {/* 필터: 지역 / 사업 / (CL일 때) 구분 */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2 flex-wrap"><FLabel ko="지역" />
          {REGIONS.map((r) => <Chip key={r} active={region === r} onClick={() => { setRegion(r); setSel(null); }}>{r}</Chip>)}</div>
        <div className="flex items-center gap-2 flex-wrap"><FLabel ko="사업" />
          {CLFFS.map((c) => <Chip key={c} active={clff === c} onClick={() => setClffR(c)}>{c}</Chip>)}</div>
        {clff === 'CL' && (
          <div className="flex items-center gap-2 flex-wrap"><FLabel ko="구분" />
            {BIZS.map((b) => <Chip key={b} active={biz === b} onClick={() => { setBiz(b); setSel(null); }}>{b}</Chip>)}</div>
        )}
      </div>
      <div className="text-[11px] text-slate-400">현재 보기: <b className="text-slate-600">{scope}</b></div>

      <OpsAlertCard topAnoms={topAnoms} thr={thr} setThr={setThr} onPick={setSel} groupNoun={groupNoun} />
      <ProfitCard rows={rows} groupNoun={groupNoun} onPick={setSel} />

      {!selEntity
        ? <ListTable rows={rows} anomalyCount={anomalyCount} groupNoun={groupNoun} onPick={setSel} />
        : <Detail e={selEntity} clff={clff} biz={biz} thr={thr} groupNoun={groupNoun} onBack={() => setSel(null)} />}

      <p className="text-[11px] text-slate-400 text-center">출처: 구글시트 ‘대쉬보드’ 2.창고별 raw · 참고용, 원본과 교차확인 권장</p>
    </div>
  );
}

function OpsAlertCard({ topAnoms, thr, setThr, onPick, groupNoun }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-amber-50/70 rounded-xl border border-amber-100 p-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-amber-800">
          ⚠️ 원가 급변 점검 {topAnoms.length ? `· ${topAnoms.length}건+` : '· 없음'} {open ? '' : '(펼치기)'}
        </button>
        <label className="text-[11px] text-amber-700 flex items-center gap-1">
          전월비 임계 <input type="range" min="20" max="80" step="5" value={thr} onChange={(e) => setThr(+e.target.value)} className="w-20 accent-amber-600" /> <b>±{thr}%</b>
        </label>
      </div>
      {open && (
        <div className="mt-2 space-y-1">
          {topAnoms.length === 0 && <div className="text-[12px] text-amber-700">1억동 이상 변동 없음.</div>}
          {topAnoms.map((a, i) => (
            <button key={i} onClick={() => onPick(a.entity)}
              className="flex items-center gap-2 w-full text-left text-[12px] hover:bg-amber-100/60 rounded px-1.5 py-1">
              <span className={`font-bold tabular-nums shrink-0 ${a.delta >= 0 ? 'text-red-500' : 'text-blue-600'}`}>{a.delta >= 0 ? '▲' : '▼'}{a.chg == null ? '신규' : Math.abs(a.chg * 100).toFixed(0) + '%'}</span>
              <span className="font-medium text-slate-700 truncate">{a.entity}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 truncate">{a.item.replace(/^\d+\.\s*/, '')}</span>
              <span className="text-slate-400 shrink-0">{a.year.slice(2)}.{a.month}</span>
              <span className="text-slate-400 ml-auto tabular-nums shrink-0">{mn(a.prev)}→{mn(a.cur)}</span>
            </button>
          ))}
          <div className="text-[10px] text-amber-600/80 pt-0.5">변동액 1억동(100백만동) 이상 + 전월비 ±{thr}% 이상. 클릭 → 해당 {groupNoun} 상세.</div>
        </div>
      )}
    </div>
  );
}

/* 수익성 점검 — 적자/저마진 Top (현재 필터 기준) */
function ProfitCard({ rows, groupNoun, onPick }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(true);
  const ranked = rows.map(({ e, v }) => {
    const rev = annualOf(v, 'revenue', OPS_CURRENT);
    const op = annualOf(v, 'opProfit', OPS_CURRENT);
    const gp = annualOf(v, 'grossProfit', OPS_CURRENT);
    return { name: e.name, region: e.region, rev, op, opM: rev ? (op / rev) * 100 : null, gpM: rev ? (gp / rev) * 100 : null };
  }).filter((x) => x.rev > 0)
    .sort((a, b) => a.opM - b.opM)            // 영업이익률 낮은 순
    .slice(0, 8);
  if (!ranked.length) return null;
  return (
    <div className="bg-rose-50/60 rounded-xl border border-rose-100 p-3">
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-rose-800">
        🩺 {lang === 'en' ? 'Profitability watch' : '수익성 점검'} · {lang === 'en' ? 'lowest OP margin' : '영업이익률 낮은 순'} {open ? '' : '(펼치기)'}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-rose-400/80 text-[11px] border-b border-rose-100">
                <th className="text-left font-medium px-2 py-1.5">{t(groupNoun)}</th>
                <th className="text-right font-medium px-2 py-1.5 whitespace-nowrap">{lang === 'en' ? 'Rev 억dong' : '매출 억동'}</th>
                <th className="text-right font-medium px-2 py-1.5 whitespace-nowrap">{lang === 'en' ? 'OP M dong' : '영업이익 백만동'}</th>
                <th className="text-right font-medium px-2 py-1.5">{lang === 'en' ? 'OP%' : '영업이익률'}</th>
                <th className="text-right font-medium px-2 py-1.5">{lang === 'en' ? 'GP%' : '매출이익률'}</th>
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
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[10px] text-rose-600/70 pt-1">{lang === 'en' ? 'Red = loss, amber = OP margin < 3%. Click to drill.' : '빨강=적자, 주황=영업이익률 3% 미만. 클릭 → 상세.'}</div>
        </div>
      )}
    </div>
  );
}

function ListTable({ rows, anomalyCount, groupNoun, onPick }) {
  const { t, lang } = useLang();
  const U = (ko, en) => (lang === 'en' ? en : ko);
  return (
    <Card title={`${t(groupNoun)} · ${OPS_CURRENT}`} hint={`${rows.length} · ${OPS_CURRENT}`}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left font-medium px-2.5 py-2 sticky left-0 bg-white">{t(groupNoun)}</th>
              <th className="text-right font-medium px-2.5 py-2 whitespace-nowrap leading-tight">{U('매출', 'Revenue')}<span className="block text-[8px] text-slate-300">{U('억동', '억dong')}</span></th>
              <th className="text-right font-medium px-2.5 py-2">{U('전년비', 'YoY')}</th>
              <th className="text-right font-medium px-2.5 py-2 whitespace-nowrap leading-tight">{U('직접원가', 'Direct Cost')}<span className="block text-[8px] text-slate-300">{U('억동', '억dong')}</span></th>
              <th className="text-right font-medium px-2.5 py-2 whitespace-nowrap leading-tight">{U('매출이익', 'Gross Profit')}<span className="block text-[8px] text-slate-300">{U('백만동', 'M dong')}</span></th>
              <th className="text-right font-medium px-2.5 py-2">{U('이익률', 'Margin')}</th>
              <th className="text-center font-medium px-2 py-2">{U('점검', 'Check')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, v }) => {
              const rev = annualOf(v, 'revenue', OPS_CURRENT);
              const dc = annualOf(v, 'directCost', OPS_CURRENT);
              const gp = annualOf(v, 'grossProfit', OPS_CURRENT);
              const mgn = rev ? (gp / rev) * 100 : null;
              const yv = yoyOf(v, 'revenue');
              const ac = anomalyCount[e.name] || 0;
              return (
                <tr key={e.name} onClick={() => onPick(e.name)}
                  className="border-b border-slate-50 last:border-0 cursor-pointer hover:bg-blue-50/50">
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

function Detail({ e, clff, biz, thr, groupNoun, onBack }) {
  const { t } = useLang();
  const [year, setYear] = useState(OPS_CURRENT);
  const [bizD, setBizD] = useState(biz);   // 상세 내 운송/창고 재선택
  const v = useMemo(() => view(e, clff === 'FF' ? 'FF' : clff, clff === 'CL' ? bizD : '전체'), [e, clff, bizD]);
  const n = opsActualCount(year);
  const flags = useMemo(() => {
    const set = {};
    for (const a of anomaliesOf(v, { threshold: thr / 100 })) set[`${a.year}|${a.item}|${a.month}`] = a.delta;
    return set;
  }, [v, thr]);
  const ranked = itemRanking(v, year);

  const PL = [
    { k: 'revenue', label: '매출', f: eok, unit: '억동', bold: true },
    { k: 'directCost', label: '직접원가', f: eok, unit: '억동' },
    { k: 'grossProfit', label: '매출이익', f: mn, unit: '백만동' },
    { k: 'opProfit', label: '영업이익', f: mn, unit: '백만동', bold: true },
  ];
  const months = Array.from({ length: 12 }, (_, i) => i);
  const segAvail = clff === 'CL';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onBack} className="text-sm text-blue-600 font-medium">‹ {t(groupNoun)}</button>
        <h2 className="text-base font-bold text-slate-800">{e.name}</h2>
        <span className="text-[11px] text-slate-400">{e.region}{e.segs?.length ? ' · ' + e.segs.join('/') : ''}</span>
        <div className="ml-auto flex gap-1">
          {OPS_YEARS.map((y) => <Chip key={y} active={year === y} onClick={() => setYear(y)}>{y.slice(2)}년</Chip>)}
        </div>
      </div>

      {segAvail && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-400">{t('구분')}</span>
          {BIZS.map((b) => <Chip key={b} active={bizD === b} onClick={() => setBizD(b)}>{b}</Chip>)}
        </div>
      )}

      <Card title="월별 손익" hint={`${year}년${clff === 'CL' && bizD !== '전체' ? ' · ' + bizD : ''}`}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="text-sm min-w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-100">
                <th className="text-left font-medium px-2.5 py-2 sticky left-0 bg-white">항목</th>
                {months.map((i) => <th key={i} className={`text-right font-medium px-2 py-2 ${i >= n ? 'text-slate-200' : ''}`}>{i + 1}월</th>)}
                <th className="text-right font-medium px-2.5 py-2 bg-slate-50">합계</th>
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
                      return <td key={i} className={`text-right px-2 py-2 tabular-nums whitespace-nowrap ${i >= n ? 'text-slate-200' : x < 0 ? 'text-red-500' : 'text-slate-700'}`}>{row.f(x)}</td>;
                    })}
                    <td className="text-right px-2.5 py-2 tabular-nums font-bold text-slate-800 bg-slate-50">{row.f(s.reduce((a, x) => a + (x || 0), 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="원가 항목 월별 모니터" hint={`${year}년 · 빨강=급증 파랑=급감 (1억동↑ ±${thr}%)`}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="text-sm min-w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-100">
                <th className="text-left font-medium px-2.5 py-2 sticky left-0 bg-white whitespace-nowrap">원가 항목<span className="block text-[9px] text-slate-300">백만동</span></th>
                {months.map((i) => <th key={i} className={`text-right font-medium px-2 py-2 ${i >= n ? 'text-slate-200' : ''}`}>{i + 1}월</th>)}
                <th className="text-right font-medium px-2.5 py-2 bg-slate-50">YTD</th>
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
                          {mn(x)}
                        </td>
                      );
                    })}
                    <td className="text-right px-2.5 py-2 tabular-nums font-semibold text-slate-700 bg-slate-50">{mn(ytdOf({ [item]: v.items?.[item] }, item, year))}</td>
                  </tr>
                );
              })}
              {ranked.length === 0 && <tr><td className="px-3 py-4 text-center text-slate-400 text-sm" colSpan={14}>원가 데이터가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-slate-400 mt-1.5">큰 항목 순 · 셀 색칠 = 전월비 ±{thr}% 이상이며 변동액 1억동 초과 → 운영팀 점검 대상</div>
      </Card>
    </div>
  );
}
