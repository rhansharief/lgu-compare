// Read the raw DPWH page dumps and the mapping table.
import { readdirSync, readFileSync } from 'node:fs';
import type { RawProject } from './parse.ts';

export const PAGES_DIR = 'data/raw/dpwh/pages';
export const MAP_CSV = 'data/psgc-map.csv';

/** All projects, de-duplicated by contractId (the live API can shift rows between pages mid-download). */
export function loadRawProjects(): RawProject[] {
  const seen = new Map<string, RawProject>();
  for (const f of readdirSync(PAGES_DIR).filter((f) => f.endsWith('.json')).sort()) {
    const body = JSON.parse(readFileSync(`${PAGES_DIR}/${f}`, 'utf8'));
    for (const p of body.data.data as RawProject[]) if (p?.contractId) seen.set(p.contractId, p);
  }
  return [...seen.values()];
}

export type Confidence = 'high' | 'medium' | 'low';
export type Method = 'text+geo' | 'text' | 'text-geo-conflict' | 'geo' | 'deo';

export interface MapRow {
  contractId: string;
  psgc: string | null;
  method: Method | null;
  confidence: Confidence | null;
}

export const MAP_HEADER = ['contract_id', 'location_text', 'dpwh_office', 'dpwh_region', 'lat', 'lng', 'psgc', 'lgu_name', 'province', 'method', 'confidence', 'geo_psgc'];

export function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function loadMap(): Map<string, MapRow> {
  const lines = readFileSync(MAP_CSV, 'utf8').split('\n').slice(1).filter(Boolean);
  const out = new Map<string, MapRow>();
  for (const line of lines) {
    const f = splitCsvLine(line);
    out.set(f[0], { contractId: f[0], psgc: f[6] || null, method: (f[9] || null) as Method | null, confidence: (f[10] || null) as Confidence | null });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}
