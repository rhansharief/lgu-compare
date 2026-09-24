#!/usr/bin/env node
// Builds data/raw/boundaries/ph-municities-2023.geojson: one FeatureCollection of all
// Philippine cities/municipalities (PSGC Adm3, as of 31 Dec 2023), simplified for fast
// point-in-polygon. See docs/boundaries-source.md.
//
// Source: altcoder/philippines-psgc-shapefiles (MIT), pinned commit below.
// Requires: node >= 20, `unzip` on PATH, network (npx pulls mapshaper).
//
// Usage: node data/raw/boundaries/build-boundaries.mjs [--simplify 5%] [--work /tmp/dir]

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = 'a44a73091f19e4950dbdc0d7cb77a5e17b101a0a'; // 2024-09-17 "fix: municity mapping of NCR and Davao City"
const LFS = `https://media.githubusercontent.com/media/altcoder/philippines-psgc-shapefiles/${COMMIT}/dist`;
const RAW = `https://raw.githubusercontent.com/altcoder/philippines-psgc-shapefiles/${COMMIT}/dist`;
const SHP_SHA256 = '9bb847cfed70656b1ad67ac8648da7867a52df69e3150eff141cd8345b9027c2';
const MAPSHAPER = 'mapshaper@0.7.66';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const SIMPLIFY = opt('--simplify', '5%');
const WORK = opt('--work', path.join(os.tmpdir(), 'lgu-compare-boundaries'));
const OUT = path.join(HERE, 'ph-municities-2023.geojson');
fs.mkdirSync(WORK, { recursive: true });

async function download(url, dest) {
  if (fs.existsSync(dest)) return dest;
  console.log('downloading', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

const csv = (text) => {
  // minimal CSV parser (handles quoted fields with commas)
  const rows = text.trim().split(/\r?\n/).map((line) => {
    const out = []; let cur = ''; let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};

const pad10 = (n) => (n == null || n === '' ? null : String(Math.trunc(Number(n))).padStart(10, '0'));

// NCR cities in this source carry their own code as adm2 (no district). PSA NCR districts:
const NCR_DISTRICT = {
  '1380600000': ['1303900000', 'NCR, City of Manila, First District'],
  ...Object.fromEntries(['1380500000', '1380700000', '1381200000', '1381300000', '1381400000']
    .map((c) => [c, ['1307400000', 'NCR, Second District']])),
  ...Object.fromEntries(['1380100000', '1380400000', '1380900000', '1381600000']
    .map((c) => [c, ['1307500000', 'NCR, Third District']])),
  ...Object.fromEntries(['1380200000', '1380300000', '1380800000', '1381000000', '1381100000', '1381500000', '1381701000']
    .map((c) => [c, ['1307600000', 'NCR, Fourth District']])),
};

// Post-2023 PSGC changes applied so codes match PSA PSGC Q2_2024 (data/raw/psa/psgc_Q2_2024_*):
// (a) Negros Island Region (RA 12000, 2024): Negros Occidental, Negros Oriental, Siquijor and
//     Bacolod City were recoded from Regions VI/VII into Region 18 (NIR). Geometry unchanged.
const NIR_PREFIX = { '06045': '18045', '07046': '18046', '07061': '18061', '06302': '18302' };
const NIR_REGION = ['1800000000', 'Negros Island Region (NIR)'];
// (b) BARMM Special Geographic Area: the 8 barangay "clusters" became municipalities in 2024
//     under the same codes. Cluster polygons are used as-is for the new municipalities.
const SGA_NAMES = {
  '1999901000': 'Kapalawan', '1999902000': 'Old Kaabakan', '1999903000': 'Kadayangan',
  '1999904000': 'Nabalawag', '1999905000': 'Pahamuddin', '1999906000': 'Malidegao',
  '1999907000': 'Ligawasan', '1999908000': 'Tugunan',
};
const recode = (c) => (c && NIR_PREFIX[c.slice(0, 5)] ? NIR_PREFIX[c.slice(0, 5)] + c.slice(5) : c);

// 1. fetch + verify shapefile
const zip = await download(`${LFS}/PH_Adm3_MuniCities.shp.zip`, path.join(WORK, 'PH_Adm3_MuniCities.shp.zip'));
const { createHash } = await import('node:crypto');
const sha = createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
if (sha !== SHP_SHA256) throw new Error(`sha256 mismatch for ${zip}: ${sha}`);
const shpDir = path.join(WORK, 'shp');
if (!fs.existsSync(path.join(shpDir, 'PH_Adm3_MuniCities.shp.shp'))) {
  execFileSync('unzip', ['-o', '-q', zip, '-d', shpDir], { stdio: 'inherit' });
}

// 2. simplify (planar, in UTM 51N source CRS) + reproject to WGS84 with mapshaper
const tmpOut = path.join(WORK, `simplified-${SIMPLIFY.replace('%', 'pct')}.json`);
execFileSync('npx', ['-y', MAPSHAPER,
  '-i', path.join(shpDir, 'PH_Adm3_MuniCities.shp.shp'),
  '-simplify', SIMPLIFY, 'keep-shapes',
  '-proj', 'wgs84',
  '-clean',
  '-o', tmpOut, 'format=geojson', 'precision=0.00001',
], { stdio: 'inherit' });

// 3. join province/region names
const prov = csv(await (await fetch(`${RAW}/PH_Adm2_ProvDists.csv`)).text());
const reg = csv(await (await fetch(`${RAW}/PH_Adm1_Regions.csv`)).text());
const provName = new Map(prov.map((r) => [pad10(r.adm2_psgc), r.adm2_en.replace(/\s*\(Not a Province\)\s*$/, '').trim() || null]));
const regName = new Map(reg.map((r) => [pad10(r.adm1_psgc), r.adm1_en]));

const src = JSON.parse(fs.readFileSync(tmpOut, 'utf8'));
const features = src.features.map((f) => {
  const p = f.properties;
  const psgc2023 = pad10(p.adm3_psgc);
  const adm2 = pad10(p.adm2_psgc);
  const psgc = recode(psgc2023);
  const isNir = psgc !== psgc2023;
  const isSga = psgc in SGA_NAMES;
  const name = SGA_NAMES[psgc] ?? String(p.adm3_en).trim(); // source has trailing spaces on some names
  const isHuc = adm2 === psgc2023; // HUCs + NCR cities: source adm2 == self
  const ncr = NCR_DISTRICT[psgc];
  return {
    type: 'Feature',
    properties: {
      psgc,                        // 10-digit PSGC string (Q2_2024 coding), e.g. "1102509000"
      psgc_2023: psgc2023,         // code as in the Dec-2023 source (differs only for NIR)
      name,
      name_2023: isSga ? String(p.adm3_en).trim() : undefined,
      geo_level: isSga ? 'Mun' : p.geo_level, // Mun | City
      province_psgc: ncr ? ncr[0] : (isHuc ? null : recode(adm2)),
      province_name: ncr ? ncr[1] : (isHuc ? null : (isSga ? 'Special Geographic Area' : provName.get(adm2) ?? null)),
      adm2_psgc_src: adm2,         // as given by source (HUCs/NCR cities point to themselves)
      region_psgc: isNir ? NIR_REGION[0] : pad10(p.adm1_psgc),
      region_name: isNir ? NIR_REGION[1] : regName.get(pad10(p.adm1_psgc)) ?? null,
      area_km2: p.area_km2,
    },
    geometry: f.geometry,
  };
}).sort((a, b) => a.properties.psgc.localeCompare(b.properties.psgc));

fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`wrote ${OUT}: ${features.length} features, ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB`);
