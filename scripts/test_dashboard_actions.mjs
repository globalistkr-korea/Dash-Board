import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalWarehouses, inputState, identityCandidates } from '../src/lib/entityIdentity.js';
import { entityComparison, comparisonMonths } from '../src/lib/entityComparison.js';
import { analysisSourceKey, analysisIssueId, analysisDraft } from '../src/lib/analysisDecision.js';
const raw=JSON.parse(readFileSync(new URL('../src/data/ops.json',import.meta.url),'utf8'));
const fields=['revenue','directCost','directProfit','indirectCost','grossProfit','opProfit'];
const sum=(table,field,year,m)=>Object.values(table).reduce((sum,e)=>sum+Object.values(e.data).reduce((n,d)=>n+(d[field]?.[year]?.[m]||0),0),0);
test('Confirmed Hai Nam alias joins August and preserves every monthly total, cost and source name',()=>{
 const before=JSON.stringify(raw.warehouses);const joined=canonicalWarehouses(raw.warehouses);
 assert.equal(JSON.stringify(raw.warehouses),before);assert.ok(joined['Hai Nam (북부)']);assert.equal(joined.HAINAM,undefined);
 for(const year of raw.years)for(const field of fields)for(let m=0;m<12;m++)assert.ok(Math.abs(sum(joined,field,year,m)-sum(raw.warehouses,field,year,m))<0.00001);
 for(const year of raw.years)for(const item of raw.costItems)for(let m=0;m<12;m++){
  const cost=table=>Object.values(table).reduce((n,e)=>n+Object.values(e.data).reduce((s,d)=>s+(d.items?.[item]?.[year]?.[m]||0),0),0);
  assert.ok(Math.abs(cost(joined)-cost(raw.warehouses))<0.00001);
 }
 assert.deepEqual(joined['Hai Nam (미지정)'],raw.warehouses['Hai Nam (미지정)']);
 for(const segment of ['창고','운송']){
  const d=joined['Hai Nam (북부)'].data[segment];
  assert.ok(d.sourceNames.includes('Oriental'));assert.ok(d.sourceNames.includes('HAINAM'));
  assert.equal(d.coverage['2026'][6],true);assert.equal(d.coverage['2026'][7],true);
 }
});
test('Different region, transport segment or new cost center blocks alias joining',()=>{
 for(const mutate of [e=>e.region='남부',e=>e.data['운송'].costCenters['2026'][7]=['NEW-SITE'],e=>e.data.FF=structuredClone(e.data['운송'])]){
  const source=structuredClone(raw.warehouses);mutate(source.HAINAM);assert.ok(canonicalWarehouses(source).HAINAM);
 }
 const joined=canonicalWarehouses(raw.warehouses);for(const name of ['VATD North (북부)','NGUYEN KHE','SGF LONG AN','DUY HUNG'])assert.deepEqual(joined[name],raw.warehouses[name]);
});
test('No rows, empty cell and recorded zero have distinct input states',()=>{
 const v={coverage:{2026:[true,true,false]},itemCoverage:{cost:{2026:[true,false,false]}}};
 assert.equal(inputState(v,'2026',[0],'cost'),'recorded');assert.equal(inputState(v,'2026',[1],'cost'),'missingValue');assert.equal(inputState(v,'2026',[2],'cost'),'noRows');
});
test('Candidate matching excludes a different region and different business segment',()=>{
 const d=(month,cc)=>({coverage:{2026:[month===0,month===1]},costCenters:{2026:[[...(month===0?[cc]:[])],[...(month===1?[cc]:[])]]}});
 const entities=[{name:'old',region:'북부',data:{창고:d(0,'CC')}},{name:'next',region:'북부',data:{창고:d(1,'CC')}},{name:'south',region:'남부',data:{창고:d(1,'CC')}},{name:'transport',region:'북부',data:{운송:d(1,'CC')}}];
 assert.deepEqual(identityCandidates(entities,'2026',[0],[1],e=>Object.keys(e.data)).map(c=>c.to),['next']);
});
test('Comparisons use equal periods, count recorded zero in averages, and suppress incomplete baselines',()=>{
 const v={coverage:{2026:[true,true,false],2025:[true,true,true]},fieldCoverage:{revenue:{2026:[true,true,false],2025:[true,true,true]},grossProfit:{2026:[true,true,false]},opProfit:{2026:[true,true,false],2025:[true,true,true]}},revenue:{2026:[100,0,0],2025:[40,20,10]},grossProfit:{2026:[30,0]},opProfit:{2026:[10,-2],2025:[4,2,1]}};
 const period=comparisonMonths('2026',0,2,'yoy');const r=entityComparison(v,'2026',period.current,period);
 assert.equal(r.monthlyAverage,50);assert.equal(r.previousRevenue,60);assert.equal(r.delta,40);assert.equal(r.opProfit,8);assert.equal(r.margin,8);
 const incomplete=entityComparison(v,'2026',[0,1,2],{previousYear:'2025',previous:[0,1,2]});assert.equal(incomplete.delta,null);assert.equal(incomplete.recordedCount,2);
 const mom=comparisonMonths('2026',2,8,'mom');assert.deepEqual(mom,{current:[1],previous:[0],previousYear:'2026'});
 assert.equal(entityComparison(v,'2026',[2],mom).revenue,null);
});
test('The same analytical issue has the same private document ID; different periods stay distinct; no opinions invented',async()=>{
 const base={sourceId:'source',kind:'warehouses',entity:'Hai Nam (북부)',item:'cost',scope:'북부|CL|창고',period:{by:'2026',bm:[6],cy:'2026',cm:[7]},reason:'cost'};
 const key=analysisSourceKey(base);assert.equal(await analysisIssueId(key),await analysisIssueId(analysisSourceKey({...base})));
 assert.notEqual(await analysisIssueId(key),await analysisIssueId(analysisSourceKey({...base,period:'2025'})));
 const draft=analysisDraft({title:'Check',evidence:'Verified facts',question:'Verify source',sources:'Original sheet',sourceKey:key},await analysisIssueId(key),'Mark');
 assert.equal(draft.revision,0);assert.equal(draft.opinion,'');assert.equal(draft.dueDate,'');assert.equal(draft.situation,'Verified facts');assert.equal(draft.actions[0].owner,'Mark');assert.equal(draft.sourceAnalysis.sourceKey,key);
});
