export function analysisSourceKey({ sourceId, kind, entity, item, scope, period, reason }) {
  return JSON.stringify([sourceId, kind, entity, item || '', scope || '', period, reason || '']);
}
export async function analysisIssueId(sourceKey) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceKey));
  return 'analysis-' + [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function analysisDraft(payload, id, owner = '') {
  return { id, title: payload.title, entity: payload.entity || '', owner, dueDate: '', status: 'review',
    situation: payload.evidence || '', impact: payload.impact || '', alternatives: '', tradeoffs: '', opinion: '',
    request: payload.question || '원인을 확인하고 필요한 조치를 결정해주세요.', sources: payload.sources || '',
    actions: [{id:'source-check',task:payload.question || '원본과 실제 원인 확인',owner,dueDate:'',done:false}],
    revision: 0, sourceAnalysis: payload,
  };
}
