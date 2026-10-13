import { analysisSourceKey } from './analysisDecision';
export function makeAnalysisPayload({source,kind,entity,item,scope,period,reason,title,evidence,question,impact,facts}) {
  const periodLabel=typeof period==='string'?period:`${period.by}년 ${period.bm.map(i=>i+1).join(',')}월 → ${period.cy}년 ${period.cm.map(i=>i+1).join(',')}월`;
  return {sourceKey:analysisSourceKey({sourceId:source.spreadsheetId,kind,entity,item,scope,period,reason}),
    title,entity,item:item||'',kind,scope,period,periodLabel,evidence,question,impact:impact||'',facts:facts||{},
    sources:[source.title,source.url,`기간: ${periodLabel} · 범위: ${scope}`,`원본 반영: ${source.importedAt}`, '원본과 실제 원인은 담당자 확인 필요'].join('\n')};
}
