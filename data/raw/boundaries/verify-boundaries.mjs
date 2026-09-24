#!/usr/bin/env node
// Sanity checks for ph-municities-2023.geojson. Dependency-free (even-odd ray casting,
// holes handled). Usage: node data/raw/boundaries/verify-boundaries.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ph-municities-2023.geojson');
const fc = JSON.parse(fs.readFileSync(file, 'utf8'));
const F = fc.features;
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPoly = (pt, rings) => inRing(pt, rings[0]) && !rings.slice(1).some((h) => inRing(pt, h));
const inGeom = (pt, g) => (g.type === 'Polygon' ? inPoly(pt, g.coordinates) : g.coordinates.some((r) => inPoly(pt, r)));
const lookup = (lng, lat) => F.filter((f) => inGeom([lng, lat], f.geometry)).map((f) => f.properties);

const codes = F.map((f) => f.properties.psgc);
check(F.length === 1642, `feature count ${F.length} (expected 1642 = 149 City + 1493 Mun)`);

// Cross-check against the PSA PSGC Q2_2024 LGU list if present.
const psaFile = path.join(path.dirname(file), '../psa/psgc_Q2_2024_income_classification.json');
if (fs.existsSync(psaFile)) {
  const j = JSON.parse(fs.readFileSync(psaFile, 'utf8'));
  const rows = (Array.isArray(j) ? j : Object.values(j).find(Array.isArray))
    .filter((r) => r.geographic_level === 'City' || r.geographic_level === 'Mun');
  const psa = new Set(rows.map((r) => r.code));
  const geo = new Set(F.map((f) => f.properties.psgc));
  const onlyPsa = [...psa].filter((c) => !geo.has(c));
  const onlyGeo = [...geo].filter((c) => !psa.has(c));
  check(!onlyPsa.length && !onlyGeo.length,
    `codes match PSA Q2_2024 City+Mun list (${rows.length}); missing=${onlyPsa.join(',') || 0} extra=${onlyGeo.join(',') || 0}`);
}
check(new Set(codes).size === codes.length, 'psgc codes unique');
check(codes.every((c) => /^\d{10}$/.test(c)), 'all psgc are 10-digit strings');
check(F.every((f) => f.geometry && /Polygon$/.test(f.geometry.type)), 'all geometries Polygon/MultiPolygon');

const mati = F.find((f) => /Mati/.test(f.properties.name));
check(!!mati, `Mati exists: ${mati && JSON.stringify(mati.properties)}`);

const tests = [
  [6.9726049, 126.3074728, 'City of Mati'],
  [14.5995, 120.9842, 'City of Manila'],
  [14.6760, 121.0437, 'Quezon City'],
  [7.2236, 124.2464, 'City of Cotabato'],
  [6.7050, 121.9710, 'City of Isabela'],
  [7.0731, 125.6128, 'City of Davao'],
];
for (const [lat, lng, want] of tests) {
  const hits = lookup(lng, lat);
  check(hits.length === 1 && hits[0].name === want,
    `(${lat}, ${lng}) -> ${hits.map((h) => `${h.name} [${h.psgc}]`).join(', ') || 'none'} (want ${want})`);
}
process.exit(failed ? 1 : 0);
