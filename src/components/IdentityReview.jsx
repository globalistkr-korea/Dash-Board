import { opsList, nameChangeCandidates, opsActualCount, OPS_SOURCE } from '../lib/ops';
import { makeAnalysisPayload } from '../lib/analysisPayload';
import AnalysisAction from './AnalysisAction';
import { useLang } from '../context/LangContext';
export default function IdentityReview({kind,region,clff,biz,year,month}) {
  const {lang}=useLang();const L=(ko,en,vi)=>lang==='en'?en:lang==='vi'?vi:ko;
  if(kind!=='warehouses')return null;
  const m=month||opsActualCount(year);
  const confirmed=opsList(kind,region,clff).filter(e=>e.aliasNames?.length);
  const candidates=m>1?nameChangeCandidates(kind,region,clff,biz,year,[m-2],[m-1]):[];
  return <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-medium text-slate-700">{L('명칭·입력 확인','Name / input review','Kiểm tra tên / dữ liệu')} · {L('연결 완료','Confirmed links','Đã liên kết')} {confirmed.length} · {L('변경 후보','Candidates','Ứng viên')} {candidates.length}</summary><div className="mt-3 space-y-3">
    {confirmed.map(e=><p key={e.name} className="text-xs text-emerald-700">✓ {e.name} ↔ {e.aliasNames.join(', ')} · {L('사용자 확인 · 원본 이름 보존 · 운송/창고 분리','User confirmed; original names retained; transport/storage separate','Đã xác nhận; giữ tên gốc; tách vận tải/kho')}</p>)}
    <p className="text-xs text-slate-500">{L('아래는 같은 지역·사업의 Cost Center가 이어지는 후보입니다. 위치·배부 변경 가능성이 있어 자동 병합하지 않습니다.','Shared cost centers within the same region/segment suggest a rename or reallocation; physical locations need confirmation. No automatic merging.','Cost Center chung trong cùng vùng/nghiệp vụ là ứng viên đổi tên/phân bổ. Cần xác nhận vị trí; không tự gộp.')}</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-xs"><thead className="text-slate-500"><tr>{[L('이전 이름','Prior name','Tên trước'),L('현재 후보','Current candidate','Tên hiện tại'),L('구분','Segment','Nghiệp vụ'),'Cost Center',L('확인 조치','Action','Hành động')].map(l=><th key={l} className="p-2 text-left font-medium">{l}</th>)}</tr></thead><tbody>{candidates.map(c=><tr key={`${c.from}|${c.to}|${c.segment}`} className="border-t"><td className="p-2">{c.from}</td><td className="p-2">{c.to}</td><td className="p-2">{c.region} · {c.segment}</td><td className="p-2">{c.costCenters.join(', ')}</td><td className="p-2"><AnalysisAction payload={makeAnalysisPayload({source:OPS_SOURCE,kind,entity:c.from,item:'명칭 확인',scope:`${c.region}|${c.segment}`,period:{by:year,bm:[m-2],cy:year,cm:[m-1]},reason:'identity',title:`${c.from} → ${c.to} 명칭·거점 확인`,evidence:`${year}년 ${m-1}→${m}월 · ${c.segment} · 동일 Cost Center ${c.costCenters.join(', ')}. 이전 이름의 실적 행이 없고 후보 이름에 실적 행이 있습니다. 동일 물리 거점 여부는 미확인입니다.`,question:'위치·창고/운송·배부 범위를 확인하고 동일 거점 여부를 확정해주세요.',facts:c})}/></td></tr>)}</tbody></table>{!candidates.length&&<p className="p-2 text-slate-500">{L('선택 기간의 명칭 변경 후보가 없습니다.','No candidates in this period.','Không có ứng viên trong kỳ.')}</p>}</div>
    <p className="text-xs text-slate-500">{L('입력 0 = 원본에 0 입력 · 미입력 = 원본 칸 미입력 · 행 없음 = 해당 대상의 실적 행 없음(종료·이관 여부 확인).','Recorded zero / empty source cell / no entity rows are shown separately.','Phân biệt 0 đã nhập / ô trống / không có dòng dữ liệu.')}</p>
  </div></details>;
}
