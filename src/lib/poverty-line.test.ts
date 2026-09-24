import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyForFamilyOfFive, parseThresholds } from './poverty-line.ts';

test('PSA yearly per-person line → monthly for a family of five', () => {
  // PSA's published 2023 national line: ₱13,873 a month for a family of five (yearly per person ₱33,295.99).
  assert.equal(monthlyForFamilyOfFive(33295.99), 13873);
});

test('parseThresholds keeps only the threshold rows', () => {
  const csv = [
    '"Geolocation","Threshold/Incidence/Parameters","Year","Value","Source status","Release","Source"',
    '"....Davao Oriental 1/, 2/","Annual Per Capita Poverty Threshold (in PhP)","2023","33616.65","","r","https://psa.example/t2a"',
    '"....Davao Oriental 1/, 2/","Poverty Incidence among Population (%)","2023","38.9","","r","https://psa.example/t2a"',
  ].join('\n');
  const { rows, source } = parseThresholds(csv);
  assert.equal(rows.size, 1);
  assert.equal(rows.get('....Davao Oriental 1/, 2/')!.get(2023), 33616.65);
  assert.equal(source, 'https://psa.example/t2a');
});
