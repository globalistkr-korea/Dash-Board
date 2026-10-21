import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cumulativeComparison, CUMULATIVE_FIELDS } from '../src/lib/cumulativeComparison.js';
import { canonicalCustomers } from '../src/lib/entityIdentity.js';

function fixture() {
  const v = { coverage: { 2025: Array(12).fill(true), 2026: Array(12).fill(true) }, fieldCoverage: {} };
  for (const field of CUMULATIVE_FIELDS) {
    v[field] = { 2025: Array(12).fill(10), 2026: Array(12).fill(20) };
    v.fieldCoverage[field] = { 2025: Array(12).fill(true), 2026: Array(12).fill(true) };
  }
  return v;
}
const compare = (v, options = {}) => cumulativeComparison(v, { year: '2026', actualCount: 8, previousActualCount: 12, ...options });
const row = (r, field = 'revenue') => r.rows.find(r => r.field === field);

test('Latest actual month compares January–August in both years, never the prior full year', () => {
  const v = fixture();
  v.revenue['2025'][8] = 9000;
  const before = JSON.stringify(v);
  const r = compare(v);
  assert.deepEqual(r.months, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(r.previousYear, '2025');
  assert.equal(row(r).previous.value, 80);
  assert.equal(row(r).current.value, 160);
  assert.equal(row(r).delta, 80);
  assert.equal(row(r).pct, 100);
  assert.equal(JSON.stringify(v), before);
});
test('Selecting March compares January–March rather than March alone; future months are excluded', () => {
  const r = compare(fixture(), { month: 3 });
  assert.equal(row(r).previous.value, 30);
  assert.equal(row(r).current.value, 60);
  assert.deepEqual(r.months, [0, 1, 2]);
  assert.equal(compare(fixture(), { month: 12 }).endMonth, 8);
});
test('Partial field input and no rows show entered subtotals and suppress all changes', () => {
  const v = fixture();
  v.fieldCoverage.revenue['2025'][2] = false;
  v.coverage['2025'][6] = false;
  const r = compare(v);
  assert.equal(row(r).previous.value, 60);
  assert.equal(row(r).previous.recordedCount, 6);
  assert.equal(row(r).previous.status, 'partial');
  assert.equal(row(r).delta, null);
  assert.equal(row(r).pct, null);
  assert.equal(row(r, 'opMargin').previous.value, null);
  v.fieldCoverage.directCost['2026'].fill(false);
  const missing = row(compare(v), 'directCost');
  assert.equal(missing.current.status, 'missingValue');
  assert.equal(missing.current.value, null);
  v.coverage['2026'][3] = false;
  assert.equal(row(compare(v), 'directCost').current.status, 'missingValue');
});
test('Recorded zero differs from no rows and unavailable years; a zero baseline has no growth rate', () => {
  const v = fixture();
  v.revenue['2025'].fill(0);
  let r = row(compare(v));
  assert.equal(r.previous.complete, true);
  assert.equal(r.previous.recordedCount, 8);
  assert.equal(r.previous.value, 0);
  assert.equal(r.delta, 160);
  assert.equal(r.pct, null);
  v.coverage['2025'].fill(false);
  r = row(compare(v));
  assert.equal(r.previous.status, 'noRows');
  assert.equal(r.previous.value, null);
  assert.equal(r.delta, null);
  r = row(compare(v, { previousActualCount: 0 }));
  assert.equal(r.previous.status, 'unavailable');
});
test('Operating margin uses ratios of cumulative totals and percentage-point change', () => {
  const v = fixture();
  v.revenue['2026'] = [100, 900];
  v.opProfit['2026'] = [50, 90];
  v.revenue['2025'] = [100, 100];
  v.opProfit['2025'] = [-10, -10];
  const r = compare(v, { month: 2 });
  assert.ok(Math.abs(row(r, 'opMargin').current.value - 14) < 1e-10);
  assert.equal(row(r, 'opMargin').previous.value, -10);
  assert.ok(Math.abs(row(r, 'opMargin').delta - 24) < 1e-10);
  assert.equal(row(r, 'opMargin').pct, null);
  assert.equal(row(r, 'opProfit').pct, 800);
});
test('An uncollected prior month and non-finite source values cannot produce a misleading change', () => {
  const v = fixture();
  let r = row(compare(v, { previousActualCount: 7 }));
  assert.equal(r.previous.value, 70);
  assert.equal(r.previous.recordedCount, 7);
  assert.equal(r.delta, null);
  v.revenue['2026'][2] = NaN;
  r = row(compare(v));
  assert.equal(r.current.value, 140);
  assert.equal(r.current.recordedCount, 7);
  assert.equal(r.delta, null);
});
test('Confirmed SPIN MASTER transport compares the actual 2025 and 2026 January–August sources', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/ops.json', import.meta.url), 'utf8'));
  const v = canonicalCustomers(raw.customers)['SPIN MASTER'].data['운송'];
  const r = compare(v);
  for (const field of CUMULATIVE_FIELDS) {
    const prior = raw.customers['SPIN MASTER TOYS FAR EAST LIMITED (북부)'].data['운송'][field]['2025'].slice(0, 8).reduce((sum, n) => sum + n, 0);
    const current = raw.customers['SPIN MASTER'].data['운송'][field]['2026'].slice(0, 8).reduce((sum, n) => sum + n, 0);
    assert.equal(row(r, field).previous.value, prior);
    assert.equal(row(r, field).current.value, current);
    assert.equal(row(r, field).delta, current - prior);
  }
  assert.equal(row(r).previous.recordedCount, 8);
  assert.equal(row(r).current.recordedCount, 8);
});
