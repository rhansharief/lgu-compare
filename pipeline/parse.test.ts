import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deoProvince, normName, normalizeCategory, normalizeStatus, parseContractors, tailSegments } from './parse.ts';

test('category: componentCategories wins, flood has priority', () => {
  assert.equal(normalizeCategory({ componentCategories: 'Roads', category: 'GAA 2025 SSP', description: '' }), 'roads');
  assert.equal(normalizeCategory({ componentCategories: 'Flood Control and Drainage, Roads', category: null, description: '' }), 'flood');
  assert.equal(normalizeCategory({ componentCategories: 'Bridges', category: null, description: '' }), 'roads');
  assert.equal(normalizeCategory({ componentCategories: 'Buildings and Facilities', category: null, description: '' }), 'buildings');
  assert.equal(normalizeCategory({ componentCategories: 'Water Provision and Storage', category: null, description: '' }), 'other');
});

test('category: keyword fallback when componentCategories is null', () => {
  assert.equal(normalizeCategory({ componentCategories: null, category: 'GAA 2025 OO-2', description: 'CONSTRUCTION OF FLOOD MITIGATION STRUCTURE ALONG X RIVER' }), 'flood');
  assert.equal(normalizeCategory({ componentCategories: null, category: 'GAA 2024 SSP', description: 'CONCRETING OF FARM TO MARKET ROAD' }), 'roads');
  assert.equal(normalizeCategory({ componentCategories: null, category: null, description: 'CONSTRUCTION OF MULTI-PURPOSE BUILDING' }), 'buildings');
  assert.equal(normalizeCategory({ componentCategories: null, category: null, description: 'WATER SUPPLY LEVEL II' }), 'other');
});

test('status', () => {
  assert.equal(normalizeStatus('Completed'), 'completed');
  assert.equal(normalizeStatus('On-Going'), 'ongoing');
  assert.equal(normalizeStatus('For Procurement'), 'procurement');
  assert.equal(normalizeStatus('Not Yet Started'), 'notstarted');
  assert.equal(normalizeStatus(null), 'unknown');
});

test('contractors: single, revoked, joint venture, missing id', () => {
  assert.deepEqual(parseContractors('RANGAY CONSTRUCTION AND SUPPLY (40117)'), [{ id: '40117', name: 'RANGAY CONSTRUCTION AND SUPPLY', revoked: false }]);
  assert.deepEqual(parseContractors('ST. TIMOTHY CONSTRUCTION CORPORATION ([REVOKED] 39196)'), [{ id: '39196', name: 'ST. TIMOTHY CONSTRUCTION CORPORATION', revoked: true }]);
  const jv = parseContractors("BERSON'S CONSTRUCTION & TRADING (31181) / JASA GD 2000 CONSTRUCTION CORPORATION (FORMERLY:JASA BUILDER'S) (31330)");
  assert.deepEqual(jv.map((c) => c.id), ['31181', '31330']);
  assert.equal(jv[1].name, "JASA GD 2000 CONSTRUCTION CORPORATION (FORMERLY:JASA BUILDER'S)");
  assert.deepEqual(parseContractors('RICHMARK CONSTRUCTION, INC. (FOR:RICHMARK CONST.) (14227)').map((c) => c.id), ['14227']);
  assert.deepEqual(parseContractors(null), []);
  assert.equal(parseContractors('A/B BUILDERS')[0].id, 'n-a-b-builders');
});

test('names normalise abbreviations and accents', () => {
  assert.equal(normName('Sta. Cruz'), 'SANTA CRUZ');
  assert.equal(normName('City of Mati'), 'CITY OF MATI');
  assert.equal(normName('Las Piñas'), 'LAS PINAS');
  assert.equal(normName('Gen. Santos City (Dadiangas)'), 'GENERAL SANTOS CITY');
});

test('tail segments, last first', () => {
  assert.deepEqual(tailSegments('CONCRETING OF X ROAD , CITY OF MATI , DAVAO ORIENTAL', 2), ['DAVAO ORIENTAL', 'CITY OF MATI']);
});

test('DEO → province', () => {
  assert.equal(deoProvince('Davao Oriental 2nd DEO'), 'DAVAO ORIENTAL');
  assert.equal(deoProvince('Abra DEO'), 'ABRA');
  assert.equal(deoProvince('Region XI'), null);
});
