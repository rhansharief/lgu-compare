import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TextMatcher } from './match.ts';
import { loadLgus, loadProvinces } from './psa.ts';

// Uses the committed PSA reference files in data/raw/psa.
const lgus = loadLgus();
const m = new TextMatcher(lgus, loadProvinces());
const name = (d: string, r: string) => {
  const hit = m.match(d, r);
  return hit ? lgus.find((l) => l.psgc === hit.psgc)!.name : null;
};

test('city with province', () => {
  assert.equal(name('CONCRETING OF X ROAD , CITY OF MATI , DAVAO ORIENTAL', 'Region XI'), 'City of Mati');
  assert.equal(name('ACCESS ROAD LEADING TO MATI FISH PORT, PHASE 4, MATI CITY, DAVAO ORIENTAL', 'Region XI'), 'City of Mati');
});

test('road named after another town resolves to the town at the end', () => {
  assert.equal(name('PAVING OF UNPAVED ROADS ALONG MATI- MARAGUSAN ROAD LUPON, DAVAO ORIENTAL', 'Region XI'), 'Lupon');
});

test('ambiguous municipality names need the province', () => {
  assert.equal(name('MULTI-PURPOSE BUILDING, SAN ISIDRO, DAVAO ORIENTAL', 'Region XI'), 'San Isidro');
  assert.equal(lgus.find((l) => l.name === 'San Isidro' && l.prov === 'Davao Oriental') != null, true);
  assert.equal(name('MULTI-PURPOSE BUILDING, SAN ISIDRO', 'Region XI'), null); // San Isidro exists in Davao Oriental and Davao del Norte
});

test('highly urbanized city under its geographic province', () => {
  assert.equal(name('CONSTRUCTION OF DRAINAGE SYSTEM, BACOLOD CITY, NEGROS OCCIDENTAL', 'Negros Island Region'), 'City of Bacolod');
});

test('Cotabato City: DPWH Region XII, PSGC BARMM', () => {
  assert.equal(name('ROAD WIDENING, COTABATO CITY', 'Region XII'), 'City of Cotabato');
});

test('common misspelling', () => {
  assert.equal(name('DRAINAGE ALONG BARANGAY PAWA, LEGASPI CITY', 'Region V'), 'City of Legazpi');
});

test('no place name → no match', () => {
  assert.equal(name('ROAD WIDENING - DAANG MAHARLIKA (LZ) - K0080 + 243 - K0080 + 435', 'Region IV-A'), null);
});
