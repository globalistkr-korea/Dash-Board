import { useEffect, useMemo, useState } from 'react';
import { entityDetails, marginDiagnosis, costItemCompare, subtypeToBiz } from '../lib/variance';
import { useLang } from '../context/LangContext';

const NOTE_PREFIX = 'vn_dashboard_report_notes_v1:';
const cleanItem = (item) => item.replace(/^(\d+)\.\s*/, '');
const signed = (value, digits = 1) => (
  value == null || !Number.isFinite(value)
    ? '-'
    : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
);
const money = (value) => Math.round(value || 0).toLocaleString('ko-KR');

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
  const noteKey = [
    cmp.by, cmp.bm.join('-'), cmp.cy, cmp.cm.join('-'), region, clff, subtype,
  ].join(':');
  const [notes, setNotes] = useState(() => loadNotes(noteKey));
  const [open, setOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem(NOTE_PREFIX + noteKey, JSON.stringify(notes));
  }, [noteKey, notes]);

  const increases = costs.filter((item) => item.delta > 0);
  const totalIncrease = increases.reduce((sum, item) => sum + item.delta, 0);
  const topCosts = increases.slice(0, 3);
  const worstWarehouse = warehouses.find((item) => item.gpDelta < -1);
  const worstCustomer = customers.find((item) => item.gpDelta < -1);
  const checks = [
    ...topCosts.map((item) => ({
      id: `cost:${item.item}`,
      title: L(`${cleanItem(item.item)} 증가 사유`, `${cleanItem(item.item)} increase`),
      evidence: L(
        `${money(item.prev)} → ${money(item.cur)}백만동, ${money(item.delta)}백만동 증가 (${signed(item.pct)}). ${item.structural ? '여러 달 반복되어 구조적 가능성이 있습니다.' : '특정 기간 집중 여부를 확인해야 합니다.'}`,
        `${money(item.prev)} → ${money(item.cur)} M dong, up ${money(item.delta)} (${signed(item.pct)}). ${item.structural ? 'Repeated across months; potentially structural.' : 'Check whether the increase is period-specific.'}`,
      ),
      question: L(
        '물량 증가, 단가 변경, 일회성 비용, 회계 조정 중 실제 원인은 무엇인가요?',
        'Was this driven by volume, rate changes, one-off cost, or accounting adjustment?',
      ),
    })),
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
  ].slice(0, 5);
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
            <ul className="space-y-1 text-[12px] leading-relaxed text-slate-700">
              <li>• {L('매출', 'Revenue')} {signed(diagnosis.revYoY)} · {L('매출이익', 'Gross profit')} {signed(diagnosis.gpYoY)} · {L('이익률', 'Margin')} {diagnosis.m0?.toFixed(1) ?? '-'}% → {diagnosis.m1?.toFixed(1) ?? '-'}%</li>
              {topCosts.map((item) => (
                <li key={item.item}>
                  • {cleanItem(item.item)}: {money(item.prev)} → {money(item.cur)} {L('백만동', 'M dong')}
                  <b className={item.delta > 0 ? 'text-red-600' : 'text-blue-600'}> ({item.delta >= 0 ? '+' : ''}{money(item.delta)}, {signed(item.pct)})</b>
                  {totalIncrease > 0 && ` · ${L('전체 증가분 영향', 'share of increase')} ${(item.delta / totalIncrease * 100).toFixed(0)}%`}
                  {item.structural ? ` · ${L('반복 상승', 'repeated rise')} 🔧` : ''}
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
                  <div key={item.id} className="rounded-md border border-slate-200 bg-white p-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {confirmed ? L('확인 완료', 'Confirmed') : L('확인 필요', 'Check')}
                      </span>
                      <b className="text-[12px] text-slate-700">{item.title}</b>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.evidence}</p>
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
