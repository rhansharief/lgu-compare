// Loads PSA reference data (PSGC list with income class & population, poverty incidence)
// from data/raw/psa into one LGU table keyed by 10-digit PSGC code.
import { existsSync, readFileSync } from 'node:fs';
import type { IslandGroup } from '../src/lib/metrics.ts';
import { normName } from './parse.ts';

const DIR = 'data/raw/psa';

export interface Lgu {
  psgc: string;
  name: string;
  kind: 'City' | 'Mun';
  cityClass: string | null; // HUC | ICC | CC
  cls: string | null; // '1st'…'6th' | 'Special'
  provPsgc: string | null;
  prov: string; // province name, or NCR district / region for LGUs outside provinces
  regCode: number;
  reg: string;
  island: IslandGroup;
  pop: number | null;
  popYear: number | null;
  capital: boolean;
}

export interface Poverty {
  value: number;
  year: number;
  prevValue: number | null;
  prevYear: number | null;
  level: 'lgu' | 'prov';
  sourceLabel: string;
}

/** The PSGC API returns UTF-8 bytes decoded as Latin-1 ("Las PiÃ±as"). Undo that. */
export function fixMojibake(s: string): string {
  if (!/[ÃÂ]/.test(s)) return s;
  try {
    const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
    if ([...s].some((c) => c.charCodeAt(0) > 255)) return s;
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return s;
  }
}

export function normClass(raw: string): string | null {
  const m = raw.match(/^(1st|2nd|3rd|4th|5th|6th|Special)/);
  return m ? m[1] : null;
}

const REGION_SHORT: Record<number, string> = {
  1: 'Region I', 2: 'Region II', 3: 'Region III', 4: 'Region IV-A', 17: 'MIMAROPA', 5: 'Region V',
  6: 'Region VI', 7: 'Region VII', 8: 'Region VIII', 9: 'Region IX', 10: 'Region X', 11: 'Region XI',
  12: 'Region XII', 13: 'NCR', 14: 'CAR', 16: 'Region XIII', 18: 'NIR', 19: 'BARMM',
};

/** DPWH `location.region` strings → PSGC region code. */
export const DPWH_REGION: Record<string, number> = {
  'Region I': 1, 'Region II': 2, 'Region III': 3, 'Region IV-A': 4, 'Region IV-B': 17, 'MIMAROPA Region': 17,
  'Region V': 5, 'Region VI': 6, 'Region VII': 7, 'Region VIII': 8, 'Region IX': 9, 'Region X': 10,
  'Region XI': 11, 'Region XII': 12, 'National Capital Region': 13, 'Cordillera Administrative Region': 14,
  'Region XIII': 16, 'Negros Island Region': 18, 'Bangsamoro Autonomous Region in Muslim Mindanao': 19, BARMM: 19,
};

function num(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(String(s).replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function loadLgus(): Lgu[] {
  const rows: any[] = JSON.parse(readFileSync(`${DIR}/psgc_Q2_2024_income_classification.json`, 'utf8')).results;
  const provByKey = new Map<string, any>();
  for (const r of rows) if (r.geographic_level === 'Prov') provByKey.set(`${r.reg}-${r.prv}`, r);

  const hucProv = hucParentProvinces(rows);
  return rows
    .filter((r) => r.geographic_level === 'City' || r.geographic_level === 'Mun')
    .map((r): Lgu => {
      const prov = provByKey.get(`${r.reg}-${r.prv}`) ?? hucProv.get(r.code);
      const pops = (r.populations ?? []).map((p: any) => ({ year: p.year, n: num(p.population) })).filter((p: any) => p.n);
      const latest = pops.sort((a: any, b: any) => b.year - a.year)[0];
      return {
        psgc: r.code,
        name: fixMojibake(r.area_name).trim(),
        kind: r.geographic_level,
        cityClass: r.city_class || null,
        cls: normClass(r.income_classification ?? ''),
        provPsgc: prov?.code ?? null,
        prov: prov ? fixMojibake(prov.area_name).trim() : r.reg === 13 ? 'Metro Manila' : REGION_SHORT[r.reg],
        regCode: r.reg,
        reg: REGION_SHORT[r.reg] ?? `Region ${r.reg}`,
        island: r.island_region as IslandGroup,
        pop: latest?.n ?? null,
        popYear: latest?.year ?? null,
        capital: /capital/i.test(r.status ?? ''),
      };
    });
}

// ---------- Poverty ----------

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); out.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out;
}

/** "....City of Manila a/, b/, c/" → { depth: 4, name: "City of Manila" } */
export function cleanGeoLabel(label: string): { depth: number; name: string } {
  const depth = label.match(/^\.*/)![0].length;
  const name = label
    .slice(depth)
    .replace(/\(w\/o.*$/i, '') // "(w/o the City of X)" – sometimes without closing paren
    .replace(/(\s+(r\d|\d\/|[a-z]\/|\*+),?)+\s*$/g, '')
    .replace(/,\s*$/, '')
    .trim();
  return { depth, name };
}

const PROV_ALIAS: Record<string, string> = {
  'MT PROVINCE': 'MOUNTAIN PROVINCE',
  'TAWI TAWI': 'TAWI TAWI',
  COTABATO: 'COTABATO',
};

/** Key used to match poverty labels against PSGC names (cities keep "CITY"). */
export function placeKey(name: string): string {
  let n = normName(name).replace(/^CITY OF (.*)$/, '$1 CITY');
  n = n.replace(/ CITY CITY$/, ' CITY');
  return PROV_ALIAS[n] ?? n;
}

/**
 * Poverty incidence among population, latest year + previous, for provinces and the cities
 * PSA reports separately (HUCs, NCR cities, Isabela City, Cotabato City).
 * If data/raw/psa/sae_municipal.csv exists (columns: psgc,year,poverty_incidence) it takes priority.
 */
export function loadPoverty(lgus: Lgu[]): Map<string, Poverty> {
  const text = readFileSync(`${DIR}/openstat_f19c15d14ad2f3c9023e_poverty_pop_prov_huc_2018_2021_2023.csv`, 'utf8').replace(/^﻿/, '');
  const rows = parseCsv(text).slice(1);
  const series = new Map<string, Map<number, number>>(); // label → year → value
  for (const r of rows) {
    if (!r[1]?.startsWith('Poverty Incidence among Population')) continue;
    const v = Number(r[3]);
    if (!r[3] || !Number.isFinite(v)) continue;
    if (!series.has(r[0])) series.set(r[0], new Map());
    series.get(r[0])!.set(Number(r[2]), v);
  }

  const provs = JSON.parse(readFileSync(`${DIR}/psgc_Q2_2024_income_classification.json`, 'utf8')).results.filter(
    (r: any) => r.geographic_level === 'Prov',
  );
  const provKey = new Map<string, string>(); // placeKey → prov psgc
  for (const p of provs) provKey.set(placeKey(fixMojibake(p.area_name)), p.code);
  const cityKey = new Map<string, string>(); // placeKey → city psgc
  for (const l of lgus) if (l.kind === 'City' || l.regCode === 13) cityKey.set(placeKey(l.name), l.psgc);

  const toPov = (label: string, s: Map<number, number>, level: Poverty['level']): Poverty => {
    const years = [...s.keys()].sort((a, b) => b - a);
    return { value: s.get(years[0])!, year: years[0], prevValue: years[1] ? s.get(years[1])! : null, prevYear: years[1] ?? null, level, sourceLabel: label };
  };

  const byProv = new Map<string, Poverty>();
  const byCity = new Map<string, Poverty>();
  for (const [label, s] of series) {
    const { depth, name } = cleanGeoLabel(label);
    if (depth < 4) continue;
    const k = placeKey(name);
    if (cityKey.has(k)) byCity.set(cityKey.get(k)!, toPov(label, s, 'lgu'));
    else if (provKey.has(k)) byProv.set(provKey.get(k)!, toPov(label, s, 'prov'));
  }

  const result = new Map<string, Poverty>();
  for (const l of lgus) {
    const p = byCity.get(l.psgc) ?? (l.provPsgc ? byProv.get(l.provPsgc) : undefined);
    if (p) result.set(l.psgc, p);
  }

  // Optional municipal Small Area Estimates, downloaded by hand from psa.gov.ph (see docs/psa-sources.md).
  const sae = `${DIR}/sae_municipal.csv`;
  if (existsSync(sae)) {
    const rows = parseCsv(readFileSync(sae, 'utf8').replace(/^﻿/, '')).slice(1);
    const bySae = new Map<string, Map<number, number>>();
    for (const [psgc, year, v] of rows) {
      if (!psgc || !Number.isFinite(Number(v))) continue;
      if (!bySae.has(psgc)) bySae.set(psgc, new Map());
      bySae.get(psgc)!.set(Number(year), Number(v));
    }
    for (const [psgc, s] of bySae) result.set(psgc.padStart(10, '0'), toPov('PSA Small Area Estimates', s, 'lgu'));
  }
  return result;
}

export function unmatchedPovertyLabels(lgus: Lgu[]): string[] {
  const pov = loadPoverty(lgus);
  const used = new Set([...pov.values()].map((p) => p.sourceLabel));
  const text = readFileSync(`${DIR}/openstat_f19c15d14ad2f3c9023e_poverty_pop_prov_huc_2018_2021_2023.csv`, 'utf8').replace(/^﻿/, '');
  const labels = new Set(parseCsv(text).slice(1).filter((r) => r[1]?.startsWith('Poverty Incidence')).map((r) => r[0]));
  return [...labels].filter((l) => cleanGeoLabel(l).depth >= 4 && !used.has(l));
}

export function loadProvinces(): { psgc: string; name: string; regCode: number }[] {
  return JSON.parse(readFileSync(`${DIR}/psgc_Q2_2024_income_classification.json`, 'utf8'))
    .results.filter((r: any) => r.geographic_level === 'Prov')
    .map((r: any) => ({ psgc: r.code, name: fixMojibake(r.area_name).trim(), regCode: r.reg }));
}

/**
 * Highly urbanized cities have their own province-level PSGC code, so the PSGC list doesn't say which
 * province they sit in. PSA poverty labels do: "Negros Occidental (w/o the City of Bacolod)",
 * "Cebu (w/o the Cities of Cebu  Lapu-Lapu and Mandaue)". Returns HUC psgc → province row.
 */
function hucParentProvinces(rows: any[]): Map<string, any> {
  const text = readFileSync(`${DIR}/openstat_f19c15d14ad2f3c9023e_poverty_pop_prov_huc_2018_2021_2023.csv`, 'utf8');
  const provs = rows.filter((r) => r.geographic_level === 'Prov');
  const cities = rows.filter((r) => r.geographic_level === 'City');
  const out = new Map<string, any>();
  const seen = new Set<string>();
  for (const m of text.matchAll(/"\.+([^"(]+?)\s*\(w\/o the Cit(?:y|ies) of ([^")]+)/g)) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    const prov = provs.find((p) => placeKey(fixMojibake(p.area_name)) === placeKey(m[1]));
    if (!prov) continue;
    const names = m[2].replace(/\s+\d\/.*$/, '').split(/\s{2,}|,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
    for (const n of names) {
      const c = cities.find((c) => c.reg === prov.reg && placeKey(fixMojibake(c.area_name)) === placeKey(`City of ${n}`));
      if (c) out.set(c.code, prov);
    }
  }
  return out;
}
