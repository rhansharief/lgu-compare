import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customPeriod, median, ordinal, peers, periodById, prevOf, rankDesc, totals, type LguIndexRow } from './metrics.ts';

const mk = (psgc: string, o: Partial<LguIndexRow> = {}): LguIndexRow => ({
  psgc, name: psgc, prov: 'P', reg: 'Region XI', island: 'Mindanao', kind: 'City', cls: '4th', pop: 100_000,
  pov: 20, povYear: 2023, povLevel: 'lgu', povPrev: null, povPrevYear: null, y: {}, top3: {}, ...o,
});

test('totals sum only years inside the period', () => {
  const l = mk('a', { y: { 2022: [1, 2, 3, 4, 2, 1, 2], 2023: [10, 0, 0, 0, 1, 1, 1], 2026: [100, 0, 0, 0, 1, 0, 1] } });
  const t = totals(l, periodById('last3')!);
  assert.equal(t.spend, 10);
  assert.equal(t.count, 1);
  const m = totals(l, periodById('marcos')!);
  assert.equal(m.spend, 110);
});

test('rank: 1 = highest, ties share rank, nulls excluded', () => {
  assert.deepEqual(rankDesc(5, [9, 5, 5, 1, null]), { rank: 2, of: 4 });
  assert.deepEqual(rankDesc(9, [9, 5]), { rank: 1, of: 2 });
  assert.equal(rankDesc(null, [1]), null);
});

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
});

test('peer groups', () => {
  const me = mk('me');
  const all = [me, mk('cityVisayas', { island: 'Visayas' }), mk('mun', { kind: 'Mun' }), mk('big', { pop: 200_000 }), mk('sameish', { pop: 125_000 })];
  assert.deepEqual(peers(me, all, 'class').map((l) => l.psgc), ['me', 'big', 'sameish']);
  assert.deepEqual(peers(me, all, 'pop').map((l) => l.psgc), ['me', 'cityVisayas', 'mun', 'sameish']);
  assert.equal(peers(me, all, 'country').length, 5);
});

test('periods: previous windows', () => {
  assert.equal(prevOf(periodById('marcos')!)!.id, 'duterte');
  assert.equal(prevOf(periodById('duterte')!), null);
  const c = customPeriod(2021, 2023);
  assert.deepEqual([prevOf(c)!.from, prevOf(c)!.to], [2018, 2020]);
  assert.equal(prevOf(customPeriod(2016, 2018)), null);
});

test('ordinal', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
});

test('class peer group widens to adjacent classes when too small', () => {
  const me = mk('me', { cls: '5th' });
  const all = [me, mk('a', { cls: '5th' }), ...['4th', '6th', '4th', '6th', '4th', '6th'].map((c, i) => mk(`n${i}`, { cls: c })), mk('far', { cls: '1st' })];
  const g = peers(me, all, 'class').map((l) => l.psgc);
  assert.equal(g.length, 8);
  assert.ok(!g.includes('far'));
});

test('BARMM LGUs are compared only with each other', () => {
  const me = mk('me');
  const b = mk('b', { reg: 'BARMM' });
  const b2 = mk('b2', { reg: 'BARMM' });
  assert.deepEqual(peers(me, [me, b, b2], 'country').map((l) => l.psgc), ['me']);
  assert.deepEqual(peers(b, [me, b, b2], 'country').map((l) => l.psgc), ['b', 'b2']);
});
