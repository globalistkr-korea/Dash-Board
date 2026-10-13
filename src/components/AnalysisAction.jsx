import { useState } from 'react';
import { useDecisionLinks } from '../context/DecisionLinkContext';
import { useLang } from '../context/LangContext';
export default function AnalysisAction({payload}) {
  const board=useDecisionLinks();const {lang}=useLang();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const linked=board.items.find(i=>i.sourceAnalysis?.sourceKey===payload.sourceKey);
  const L=(ko,en,vi)=>lang==='en'?en:lang==='vi'?vi:ko;
  const status=linked?({review:L('결정 필요','Decision needed','Cần quyết định'),active:L('진행 중','In progress','Đang xử lý'),done:L('완료','Done','Hoàn thành'),archived:L('보관','Archived','Lưu trữ')}[linked.status]):null;
  return <div className="inline-flex flex-col items-end gap-1"><button disabled={busy} onClick={async event=>{event.stopPropagation();setBusy(true);setError('');try{await board.openAnalysis(payload);}catch{setError(L('연결 실패 · 다시 시도해주세요','Could not open; try again','Không thể mở; thử lại'));}finally{setBusy(false);}}} className={'whitespace-nowrap rounded-lg border px-2 py-1 text-xs font-medium '+(linked?.status==='done'?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-blue-200 bg-blue-50 text-blue-700')}>{busy?L('여는 중…','Opening…','Đang mở…'):linked?`${status} · ${L('보기','View','Xem')}`:L('조치 등록','Add action','Tạo hành động')}</button>{error&&<span role="status" className="text-xs text-red-600">{error}</span>}</div>;
}
