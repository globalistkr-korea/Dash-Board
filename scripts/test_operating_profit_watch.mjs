import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalCustomers, canonicalWarehouses } from '../src/lib/entityIdentity.js';
import { monthlyPeriod } from '../src/lib/monthlyPeriod.js';
import { operatingProfitWatch, watchBusinessScope } from '../src/lib/operatingProfitWatch.js';

const fields = ['revenue', 'grossProfit', 'opProfit'];
const counts = { 2025: 12, 2026: 9 };
const cmp = { by: '2025', bm: [0, 1], cy: '2026', cm: [0, 1] };
function segment(before, after) {
  return {
    coverage: { 2025: [true, true], 2026: [true, true] },
    fieldCoverage: Object.fromEntries(fields.map(f => [f, { 2025: [true, true], 2026: [true, true] }])),
    ...Object.fromEntries(fields.map((f, i) => [f, { 2025: before[i], 2026: after[i] }])),
  };
}
const entity = (name, ...segments) => ({ name, region: '북부', segments });

test('Ranks the five largest declines, excluding increases, regardless of current profit level', () => {
  const rows = [0, -1, 2, -8, -7, -4, -2, -6].map((d, i) =>
    entity(String(i), segment([[100, 100], [40, 40], [10, 10]], [[100, 100], [40, 40], [10, 10 + d]])));
  const result = operatingProfitWatch(rows, cmp, counts);
  assert.deepEqual(result.rows.map(r => r.delta.opProfit), [-8, -7, -6, -4, -2]);
  assert.equal(result.excluded, 0);
});

test('Uses exact month ranges, cumulative weighted margin, and a reconciled GP / SG&A bridge', () => {
  const row = entity('A', segment([[100, 300], [30, 70], [10, 50]], [[200, 100], [50, 60], [30, -10]]));
  const [all] = operatingProfitWatch([row], cmp, counts).rows;
  assert.equal(all.before.opMargin, 15);
  assert.ok(Math.abs(all.after.opMargin - 20 / 300 * 100) < 1e-12);
  assert.equal(all.delta.opProfit, -40);
  assert.equal(all.delta.grossProfit, 10);
  assert.equal(all.delta.sga, 50);
  assert.equal(all.delta.grossProfit - all.delta.sga, all.delta.opProfit);
  assert.equal(all.after.costOfSales, 190);
  const mom = { by: '2026', bm: [0], cy: '2026', cm: [1] };
  const [monthly] = operatingProfitWatch([row], mom, counts).rows;
  assert.equal(monthly.before.opProfit, 30);
  assert.equal(monthly.after.opProfit, -10);
});

test('Recorded zero is comparable; missing segment values and rows are not filled with zero', () => {
  const zero = segment([[10, 10], [5, 5], [1, 1]], [[10, 10], [4, 4], [0, 0]]);
  const missing = structuredClone(zero);
  missing.fieldCoverage.opProfit['2026'][1] = false;
  const missingRow = structuredClone(zero);
  missingRow.coverage['2026'][1] = false;
  const result = operatingProfitWatch([entity('zero', zero), entity('mixed', zero, missing),
    entity('partial', missingRow)], cmp, counts);
  assert.deepEqual(result.rows.map(r => [r.name, r.after.opProfit]), [['zero', 0]]);
  assert.equal(result.excluded, 2);
  assert.equal(operatingProfitWatch([entity('zero', zero)], cmp, { ...counts, 2026: 1 }).rows.length, 0);
});

test('Can rank a complete profit decline while withholding margins and SG&A without their inputs', () => {
  const zero = segment([[0, 0], [5, 5], [1, 1]], [[0, 0], [4, 4], [0, 0]]);
  zero.fieldCoverage.grossProfit['2026'][0] = false;
  const [row] = operatingProfitWatch([entity('A', zero)], cmp, counts).rows;
  assert.equal(row.delta.opProfit, -2);
  assert.equal(row.delta.opMargin, null);
  assert.equal(row.delta.sga, null);
  assert.equal(row.delta.costOfSales, null);
});

test('Maps only supported detailed businesses so drill-down never silently widens scope', () => {
  assert.equal(watchBusinessScope('CL', 'WM'), '창고');
  assert.equal(watchBusinessScope('CL', 'TM'), '운송');
  assert.equal(watchBusinessScope('FF', '전체'), '전체');
  assert.equal(watchBusinessScope('FF', '해상'), null);
  assert.equal(watchBusinessScope('CL', 'S/P'), null);
});

test('Real north customer and warehouse rows reconcile to the exact months and scoped original figures', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/ops.json', import.meta.url), 'utf8'));
  const period = monthlyPeriod({ year: '2026', month: 0, actualCount: raw.actualMonths['2026'],
    previousActualCount: raw.actualMonths['2025'], hasPreviousYear: true, compareBasis: 'ytd' }).comparison;
  for (const entities of [canonicalCustomers(raw.customers), canonicalWarehouses(raw.warehouses)]) {
    const north = Object.entries(entities).filter(([, e]) => e.region === '북부')
      .map(([name, e]) => entity(name, ...Object.values(e.data)));
    const { rows, excluded } = operatingProfitWatch(north, period, raw.actualMonths);
    assert.equal(rows.length, 5);
    assert.ok(excluded > 0);
    assert.ok(rows.every((row, i) => row.delta.opProfit < 0 && (i === 0 || rows[i - 1].delta.opProfit <= row.delta.opProfit)));
    for (const r of rows) {
      const source = Object.values(entities[r.name].data);
      const amount = (y, months) => source.reduce((sum, s) => sum + months.reduce((n, m) => n + (s.opProfit?.[y]?.[m] ?? 0), 0), 0);
      assert.ok(Math.abs(r.before.opProfit - amount(period.by, period.bm)) < 1e-8);
      assert.ok(Math.abs(r.after.opProfit - amount(period.cy, period.cm)) < 1e-8);
      if (r.delta.sga != null) assert.ok(Math.abs(r.delta.grossProfit - r.delta.sga - r.delta.opProfit) < 1e-8);
    }
  }
});
