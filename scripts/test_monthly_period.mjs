import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeMonthlyView, monthlyPeriod, monthlyMetricRows } from '../src/lib/monthlyPeriod.js';

const allPeriod = overrides => monthlyPeriod({ year: '2026', month: 0, actualCount: 8,
  previousActualCount: 12, hasPreviousYear: true, compareBasis: 'mom', ...overrides });

test('All is the default and persists as a distinct selection while the source period grows', () => {
  assert.deepEqual(normalizeMonthlyView({}, 8), { month: 0, compareBasis: 'ytd', viewMode: '요약' });
  const saved = normalizeMonthlyView({ month: 0, viewMode: '상세', compareBasis: 'mom' }, 8);
  assert.equal(saved.compareBasis, 'ytd');
  assert.equal(normalizeMonthlyView(saved, 9).month, 0);
  assert.equal(allPeriod({ actualCount: 9 }).throughMonth, 9);
  for (const month of [null, false, '', -1, 2.5, 'wrong']) assert.equal(normalizeMonthlyView({ month }, 8).month, 0);
  assert.equal(normalizeMonthlyView({ month: 12 }, 8).month, 8);
  assert.equal(normalizeMonthlyView({ month: 1, compareBasis: 'mom' }, 8).compareBasis, 'yoy');
});
test('All forces identical January–August periods for both the table and analysis', () => {
  const period = allPeriod();
  assert.equal(period.isAll, true);
  assert.equal(period.basis, 'ytd');
  assert.equal(period.throughMonth, 8);
  assert.deepEqual(period.comparison, { by: '2025', bm: [0,1,2,3,4,5,6,7], cy: '2026', cm: [0,1,2,3,4,5,6,7] });
  const rows = monthlyMetricRows(['매출'], year => year === '2026' ? [...Array(8).fill(20), 9999] : [...Array(8).fill(10), 5000], period);
  assert.equal(rows[0].ytdP, 80);
  assert.equal(rows[0].ytdC, 160);
  assert.equal(rows[0].ytdDelta, 80);
  assert.equal(rows[0].ytdYoy, 100);
  assert.equal(rows[0].annual, 160);
});
test('Single month, MoM and year-to-date retain their own exact comparison periods', () => {
  assert.deepEqual(allPeriod({ month: 3, compareBasis: 'mom' }).comparison, { by: '2026', bm: [1], cy: '2026', cm: [2] });
  assert.deepEqual(allPeriod({ month: 3, compareBasis: 'yoy' }).comparison, { by: '2025', bm: [2], cy: '2026', cm: [2] });
  assert.deepEqual(allPeriod({ month: 3, compareBasis: 'ytd' }).comparison, { by: '2025', bm: [0,1,2], cy: '2026', cm: [0,1,2] });
  const row = monthlyMetricRows(['매출'], year => year === '2026' ? [10,20,30] : [2,4,6], allPeriod({ month: 3, compareBasis: 'yoy' }))[0];
  assert.equal(row.cm, 30); assert.equal(row.ym, 6); assert.equal(row.pm, 20);
  assert.equal(row.ytdC, 60); assert.equal(row.ytdP, 12);
});
test('Missing matching year/region or a shorter prior collection never becomes a zero comparison', () => {
  for (const overrides of [{hasPreviousYear:false}, {previousActualCount:7}]) {
    const period = allPeriod(overrides);
    assert.equal(period.comparison, null);
    const row = monthlyMetricRows(['매출'], () => [10,20,30], period)[0];
    assert.equal(row.ytdP, null); assert.equal(row.ytdDelta, null); assert.equal(row.ytdYoy, null);
  }
  assert.equal(allPeriod({ year:'2025', actualCount:12 }).throughMonth, 12);
});
test('Zero and negative prior totals have guarded growth rates', () => {
  let row = monthlyMetricRows(['이익'], year => year === '2026' ? [10] : [0], allPeriod())[0];
  assert.equal(row.ytdDelta, 10); assert.equal(row.ytdYoy, null);
  row = monthlyMetricRows(['이익'], year => year === '2026' ? [-5] : [-10], allPeriod())[0];
  assert.equal(row.ytdDelta, 5); assert.equal(row.ytdYoy, 50);
});
test('The screenshot scope CL/TM/North matches real source sums through August, not August alone', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/plan3y.json', import.meta.url), 'utf8'));
  const get = year => raw.data[year]['매출'].leaves.filter(l => l.clff === 'CL' && l.region === '북부' && l.subtype === 'TM');
  const getSeries = year => Array.from({length:12},(_,i)=>get(year).reduce((sum,l)=>sum+(l.values[i]||0),0));
  const r = monthlyMetricRows(['매출'], getSeries, allPeriod())[0];
  const expected = year => get(year).reduce((sum,l)=>sum+l.values.slice(0,8).reduce((n,v)=>n+(v||0),0),0);
  assert.ok(Math.abs(r.ytdC - expected('2026')) < 1e-6);
  assert.ok(Math.abs(r.ytdP - expected('2025')) < 1e-6);
  assert.notEqual(r.ytdC, r.cm);
  assert.notEqual(r.ytdP, getSeries('2025').reduce((sum,n)=>sum+n,0));
});
