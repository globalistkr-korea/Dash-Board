import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { customerRankings } from '../src/lib/customerRankings.js';
import { CUMULATIVE_FIELDS } from '../src/lib/cumulativeComparison.js';
import { canonicalCustomers } from '../src/lib/entityIdentity.js';

const options = { year:'2026', actualCount:8, previousActualCount:12 };
function fixture(name, revenue, profit, operating = profit) {
  const v = { coverage:{2025:Array(12).fill(true),2026:Array(12).fill(true)},fieldCoverage:{} };
  for (const field of CUMULATIVE_FIELDS) {
    const value = field === 'revenue' ? revenue : field === 'grossProfit' ? profit : field === 'opProfit' ? operating : 0;
    v[field] = { 2025:[value / 2,...Array(11).fill(0)],2026:[value,...Array(11).fill(0)] };
    v.fieldCoverage[field] = { 2025:Array(12).fill(true),2026:Array(12).fill(true) };
  }
  return {e:{name,region:'북부'},v};
}

test('Revenue and profit have independent top 10 lists; shares use every customer in scope', () => {
  const rows = Array.from({length:12},(_,i)=>fixture(`C${String(i+1).padStart(2,'0')}`,i+1,12-i));
  const before = JSON.stringify(rows);
  const r = customerRankings(rows,options);
  assert.equal(r.revenue.length,10); assert.equal(r.profit.length,10);
  assert.equal(r.revenue[0].name,'C12'); assert.equal(r.profit[0].name,'C01');
  assert.equal(r.revenueTotal,78); assert.equal(r.topRevenue,75);
  assert.equal(r.revenue[0].share,12/78*100); assert.equal(r.topRevenueShare,75/78*100);
  assert.deepEqual(r.revenue.map(r=>r.rank),[1,2,3,4,5,6,7,8,9,10]);
  assert.equal(JSON.stringify(rows),before);
});
test('Operating-profit switch changes the ranking metric and uses the corresponding margin', () => {
  const rows = [fixture('gross leader',100,50,2),fixture('operating leader',200,20,30)];
  assert.equal(customerRankings(rows,options).profit[0].name,'gross leader');
  const r = customerRankings(rows,{...options,profitField:'opProfit'});
  assert.equal(r.profitField,'opProfit'); assert.equal(r.profit[0].name,'operating leader');
  assert.equal(r.profit[0].margin,15);
});
test('Selecting August ranks January–August even if the customer has no August row', () => {
  const priorOnly = fixture('earlier revenue',500,20);
  priorOnly.v.coverage['2026'][7] = false;
  const current = fixture('August revenue',100,10);
  current.v.revenue['2026'][7] = 100;
  const r = customerRankings([priorOnly,current],{...options,month:8});
  assert.equal(r.endMonth,8); assert.equal(r.revenue[0].name,'earlier revenue');
  assert.equal(r.revenue[0].current.value,500); assert.equal(r.revenue[0].current.recordedCount,7);
  assert.equal(r.revenue[0].delta,null);
  priorOnly.v.revenue['2026'][8] = 99999;
  assert.equal(customerRankings([priorOnly],options).revenue[0].current.value,500);
});
test('Partial prior input keeps the observed subtotal but suppresses changes; year/region guards suppress the prior value', () => {
  const row = fixture('partial',100,10);
  row.v.fieldCoverage.revenue['2025'][2] = false;
  let r = customerRankings([row],options).revenue[0];
  assert.equal(r.previous.value,50); assert.equal(r.previous.recordedCount,7);
  assert.equal(r.delta,null); assert.equal(r.pct,null);
  r = customerRankings([row],{...options,allowPreviousYear:false}).revenue[0];
  assert.equal(r.previous.value,null); assert.equal(r.delta,null);
});
test('Recorded zero, negative profit and absent field input remain distinct', () => {
  const rows = [fixture('zero',0,0),fixture('loss',100,-10),fixture('missing',30,20)];
  rows[2].v.fieldCoverage.grossProfit['2026'].fill(false);
  const r = customerRankings(rows,options);
  assert.equal(r.revenue.find(r=>r.name==='zero').current.value,0);
  assert.equal(r.profit.find(r=>r.name==='zero').pct,null);
  assert.equal(r.profit.find(r=>r.name==='loss').current.value,-10);
  assert.equal(r.profit.some(r=>r.name==='missing'),false);
  assert.equal(r.profit[0].name,'zero');
  assert.deepEqual(customerRankings([],options).revenue,[]);
});
test('Changing the cumulative cutoff recalculates the ranking without using a later month', () => {
  const a = fixture('A',100,1), b = fixture('B',50,2);
  b.v.revenue['2026'][3] = 200;
  assert.equal(customerRankings([a,b],{...options,month:3}).revenue[0].name,'A');
  assert.equal(customerRankings([a,b],{...options,month:4}).revenue[0].name,'B');
});
test('North source top 10 and the full revenue denominator reconcile to the original numeric rows', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/ops.json',import.meta.url),'utf8'));
  const customers = Object.entries(canonicalCustomers(raw.customers)).filter(([,e])=>e.region==='북부');
  const rows = customers.map(([name,e])=>{
    const segments = Object.values(e.data);
    const v = {coverage:{},fieldCoverage:{}};
    for(const year of raw.years) v.coverage[year] = Array.from({length:12},(_,m)=>segments.some(d=>d.coverage?.[year]?.[m]));
    for(const field of CUMULATIVE_FIELDS){
      v[field]={}; v.fieldCoverage[field]={};
      for(const year of raw.years){
        v[field][year]=Array.from({length:12},(_,m)=>segments.reduce((n,d)=>n+(d[field]?.[year]?.[m]||0),0));
        v.fieldCoverage[field][year]=Array.from({length:12},(_,m)=>segments.some(d=>d.fieldCoverage?.[field]?.[year]?.[m]));
      }
    }
    return {e:{name,...e},v};
  });
  const r = customerRankings(rows,options);
  const sourceTotals = customers.map(([name,e])=>({name,value:Object.values(e.data).reduce((n,d)=>n+(d.revenue?.['2026']||[]).slice(0,8).reduce((s,v)=>s+(v||0),0),0)})).filter(r=>r.value!==0).sort((a,b)=>b.value-a.value);
  assert.deepEqual(r.revenue.map(r=>r.name),sourceTotals.slice(0,10).map(r=>r.name));
  assert.ok(Math.abs(r.revenueTotal-sourceTotals.reduce((n,r)=>n+r.value,0))<1e-6);
  assert.equal(r.revenue.filter(r=>r.name==='SPIN MASTER').length,1);
});
