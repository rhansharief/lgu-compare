import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contractorCount, displayName, headline, moneyPhrase, periodPhrase } from './headline.ts';
import { periodById, type LguIndexRow, type YearRow } from './metrics.ts';

const yr = (roads: number, flood = 0): YearRow => [flood, roads, 0, 0, 1, 1, 1];
const mk = (psgc: string, spend: number, o: Partial<LguIndexRow> = {}): LguIndexRow => ({
  psgc, name: psgc, prov: 'Davao Oriental', reg: 'Region XI', island: 'Mindanao', kind: 'City', cls: '4th', pop: 1000,
  pov: null, povYear: null, povLevel: null, povPrev: null, povPrevYear: null, y: { 2024: yr(spend) }, top3: {}, ...o,
});
const last3 = periodById('last3')!;

test('headline: ratio against the peer median, category, contractors, poverty', () => {
  const me = mk('City of Mati', 2_000_000, {
    cls: '5th', pov: 38.9, povYear: 2023, povLevel: 'prov', povPrev: 30.4, povPrevYear: 2021,
    y: { 2024: yr(1_500_000, 500_000) },
  });
  const all = [me, ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((p) => mk(p, 1_000_000, { cls: '4th' }))];
  assert.equal(
    headline({ me, all, mode: 'class', per: last3, top3: 0.376, contractors: 41 }),
    'Over the last 3 years, Mati got about 2.0 times the national road-and-flood money per person that similar cities in Mindanao got, mostly for roads and bridges, spread across 41 companies. ' +
      'Meanwhile, poverty in Davao Oriental province got worse: about 4 in 10 people are now poor.',
  );
});

test('headline: "about the same" within 0.9–1.1×, concentrated contractors, own poverty figure', () => {
  const y25 = (spend: number) => ({ y: { 2025: yr(spend) } });
  const me = mk('Lupon', 0, { kind: 'Mun', pov: 20, povYear: 2023, povLevel: 'lgu', povPrev: 24, povPrevYear: 2021, ...y25(1_050_000) });
  const all = [me, mk('a', 0, { kind: 'Mun', ...y25(1_000_000) }), mk('b', 0, { kind: 'Mun', ...y25(1_000_000) })];
  const h = headline({ me, all, mode: 'region', per: periodById('latest')!, top3: 0.8, contractors: 9 });
  assert.match(h, /^In 2025, Lupon got about the same national road-and-flood money per person as other cities and towns in Region XI, /);
  assert.match(h, /, with 80% going to just 3 companies\./);
  assert.match(h, /Meanwhile, poverty in Lupon got better: about 2 in 10 people are now poor\.$/);
});

test('headline: no projects, no poverty figure', () => {
  const me = mk('X', 0);
  assert.equal(headline({ me, all: [me, mk('a', 5)], mode: 'region', per: last3, top3: null, contractors: 0 }),
    'Over the last 3 years, no national road-and-flood projects could be placed in X.');
});

test('helpers', () => {
  assert.equal(displayName({ name: 'Island Garden City of Samal' }), 'the Island Garden City of Samal');
  assert.equal(displayName({ name: 'Lupon' }), 'Lupon');
  assert.equal(periodPhrase(periodById('marcos')!), 'Under the current president (since July 2022)');
  assert.equal(moneyPhrase(0.4, 'similar towns in Luzon'), 'less than half the national road-and-flood money per person that similar towns in Luzon got');
  assert.equal(moneyPhrase(0.7, 'similar towns in Luzon'), 'about 1.4 times less national road-and-flood money per person than similar towns in Luzon');
  const projects = [['1', '', 'roads', 'completed', 1, 2024, ['a', 'b']], ['2', '', 'roads', 'completed', 1, 2019, ['c']], ['3', '', 'roads', 'ongoing', 1, 2025, ['a']]];
  assert.equal(contractorCount(projects, last3), 2);
});

test('headline: a top category at 50% reads "about half"', () => {
  const me = mk('Lupon', 0, { kind: 'Mun', y: { 2024: [499, 501, 0, 0, 1, 1, 1] } });
  assert.match(headline({ me, all: [me], mode: 'region', per: last3, top3: 0.3, contractors: 9 }), /, about half for roads and bridges, spread across 9 companies\.$/);
});
