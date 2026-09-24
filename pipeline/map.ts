// Step 2: map every DPWH project to a PSGC city/municipality.
// Output: data/psgc-map.csv (CC0, committed) — one row per contract.
//
// Two independent signals:
//   text — the place named at the end of the description ("…, CITY OF MATI, DAVAO ORIENTAL")
//   geo  — the project's lat/lng inside a municipal boundary polygon
// Decision:
//   both agree                    → high
//   text only, province named     → high   (text+province is how DPWH itself labels the site)
//   text only, name unique in region → medium
//   both, but disagree            → text wins, medium (coordinates are unverified in the source)
//   geo only (inside DPWH region) → medium
//   city DEO only ("Iligan City DEO") → low
//   nothing                       → unmapped (counted in data coverage)
import { readFileSync, writeFileSync } from 'node:fs';
import Flatbush from 'flatbush';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { TextMatcher, regionsFor } from './match.ts';
import { loadLgus, loadProvinces, placeKey } from './psa.ts';
import { MAP_CSV, MAP_HEADER, csvEscape, loadRawProjects, type Confidence, type Method } from './raw.ts';

export const BOUNDARIES = 'data/raw/boundaries/ph-municities-2023.geojson';

export class GeoIndex {
  private index: Flatbush;
  private features: any[];
  constructor(geojson: any, private psgcOf: (f: any) => string | null) {
    this.features = geojson.features.filter((f: any) => f.geometry && psgcOf(f));
    this.index = new Flatbush(this.features.length);
    for (const f of this.features) {
      let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) for (const [x, y] of poly[0]) {
        if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      this.index.add(minX, minY, maxX, maxY);
    }
    this.index.finish();
  }
  lookup(lat: number, lng: number): string | null {
    const pt = point([lng, lat]);
    for (const i of this.index.search(lng, lat, lng, lat)) {
      if (booleanPointInPolygon(pt, this.features[i])) return this.psgcOf(this.features[i]);
    }
    return null;
  }
}

function inPhilippines(lat: number | null, lng: number | null): lat is number {
  return lat != null && lng != null && lat > 4 && lat < 22 && lng > 116 && lng < 127.5;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lgus = loadLgus();
  const byPsgc = new Map(lgus.map((l) => [l.psgc, l]));
  const text = new TextMatcher(lgus, loadProvinces());
  const { psgcFromFeature } = await import('./boundaries.ts');
  const geo = new GeoIndex(JSON.parse(readFileSync(BOUNDARIES, 'utf8')), (f) => {
    const c = psgcFromFeature(f);
    return c && byPsgc.has(c) ? c : null;
  });

  // City DEOs cover a single city: "Iligan City DEO", "Cagayan de Oro City 1st DEO".
  const cityByKey = new Map<string, string>();
  for (const l of lgus) if (l.kind === 'City') cityByKey.set(placeKey(l.name), l.psgc);
  const deoCity = (deo: string | null): string | null => {
    const m = deo?.match(/^(.*\bCity)\s+(?:\d+(?:st|nd|rd|th)\s+)?DEO$/i);
    return m ? cityByKey.get(placeKey(m[1])) ?? null : null;
  };

  const projects = loadRawProjects();
  const stats: Record<string, number> = {};
  const lines = [MAP_HEADER.join(',')];
  for (const p of projects.sort((a, b) => a.contractId.localeCompare(b.contractId))) {
    const region = p.location?.region ?? null;
    const regCodes = regionsFor(region);
    const t = text.match(p.description ?? '', region);
    let g = inPhilippines(p.latitude, p.longitude) ? geo.lookup(p.latitude, p.longitude!) : null;
    // A point outside the DPWH region is a bad coordinate, not a cross-region project.
    if (g && regCodes != null && !regCodes.includes(byPsgc.get(g)!.regCode)) g = null;

    let psgc: string | null = null, method: Method | null = null, conf: Confidence | null = null;
    if (t && g && t.psgc === g) [psgc, method, conf] = [t.psgc, 'text+geo', 'high'];
    else if (t && g) [psgc, method, conf] = [t.psgc, 'text-geo-conflict', 'medium'];
    else if (t) [psgc, method, conf] = [t.psgc, 'text', t.provinceConfirmed ? 'high' : 'medium'];
    else if (g) [psgc, method, conf] = [g, 'geo', 'medium'];
    else {
      const d = deoCity(p.location?.province ?? null);
      if (d) [psgc, method, conf] = [d, 'deo', 'low'];
    }
    stats[method ?? 'unmapped'] = (stats[method ?? 'unmapped'] ?? 0) + 1;

    const l = psgc ? byPsgc.get(psgc)! : null;
    const tail = (p.description ?? '').replace(/\s+/g, ' ').split(',').slice(-2).join(',').trim().slice(0, 120);
    lines.push(
      [p.contractId, tail, p.location?.province, region, p.latitude, p.longitude, psgc, l?.name, l?.prov, method, conf, g]
        .map(csvEscape)
        .join(','),
    );
  }
  writeFileSync(MAP_CSV, lines.join('\n') + '\n');
  const n = projects.length;
  console.log(`mapped ${n - (stats.unmapped ?? 0)}/${n} (${(100 - (100 * (stats.unmapped ?? 0)) / n).toFixed(1)}%)`);
  for (const [k, v] of Object.entries(stats).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${v}`);
}
