export function todayVN(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
}
export function urgency(item, today = todayVN()) {
  if (['done', 'archived'].includes(item.status)) return 'closed';
  if (!item.dueDate) return 'normal';
  if (item.dueDate < today) return 'overdue';
  const days = (Date.parse(item.dueDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000;
  return days <= 3 ? 'soon' : 'normal';
}
export const STEPS = [
 ['situation','현상·리스크','Situation / risk','Hiện trạng / Rủi ro'],
 ['impact','영향','Impact','Tác động'],
 ['alternatives','가능한 대안','Alternatives','Các phương án'],
 ['tradeoffs','대안별 장단점','Pros / cons','Ưu / Nhược điểm'],
 ['opinion','내 최종 의견','My recommendation','Đề xuất của tôi'],
 ['request','요청 의사결정','Decision requested','Nội dung cần quyết định'],
];
export function decisionReport(item, lang = 'ko') {
  const index = lang === 'vi' ? 3 : lang === 'en' ? 2 : 1;
  return [item.title, `${item.entity || '-'} · ${item.owner || '-'} · ${item.dueDate || '-'}`,
    ...STEPS.map(([key,...labels], i) => `${i+1}. ${labels[index-1]}\n${item[key] || '-'}`),
    (lang==='vi'?'Hành động tiếp theo':lang==='en'?'Next actions':'후속조치') + '\n' + (item.actions || []).map(a=>`${a.done?'✓':'□'} ${a.task} · ${a.owner || '-'} · ${a.dueDate || '-'}`).join('\n'),
    (lang==='vi'?'Nguồn':lang==='en'?'Sources':'근거') + '\n' + (item.sources || '-'),
    lang==='vi'?'Chỉ để tham khảo; kiểm tra lại số liệu với nguồn gốc.':lang==='en'?'For reference; cross-check figures against original sources.':'참고용 · 수치는 원본 근거와 교차확인 권장',
  ].join('\n\n');
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return; } catch { /* iOS standalone fallback */ }
  const box = document.createElement('textarea'); box.value=text; box.style.position='fixed'; box.style.top='0'; box.style.opacity='0'; document.body.append(box); box.focus(); box.select(); box.setSelectionRange(0,text.length);
  const ok=document.execCommand('copy'); box.remove(); if(!ok) throw new Error('copy-failed');
}
