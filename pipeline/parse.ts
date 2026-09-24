// Field-level parsing of raw DPWH project records. Pure functions, unit-tested in parse.test.ts.
import type { Category } from '../src/lib/metrics.ts';

export interface RawProject {
  contractId: string;
  description: string;
  category: string | null;
  componentCategories: string | null;
  status: string | null;
  budget: number | null;
  location: { province: string | null; region: string | null } | null;
  contractor: string | null;
  startDate: string | null;
  completionDate: string | null;
  infraYear: string | null;
  programName: string | null;
  sourceOfFunds: string | null;
  latitude: number | null;
  longitude: number | null;
}

// ---------- Category ----------
// componentCategories holds 19 clean values (sometimes several, comma-joined, alphabetical).
// When several apply we pick by priority: flood > roads/bridges > buildings > other,
// because flood control is the category the site tracks most closely.
// When it is null we fall back to keywords in `category` + `description`.

const FLOOD_RE = /FLOOD|DRAINAGE|RIVER CONTROL|REVETMENT|DIKE|SEAWALL|SEA WALL|HYDRAULIC/i;
const ROAD_RE = /ROAD|BRIDGE|HIGHWAY|HI-WAY|FLYOVER|BYPASS|DIVERSION|INTERCHANGE|PAVEMENT|PCCP/i;
const BUILDING_RE = /BUILDING|CLASSROOM|SCHOOL|FACILIT|CENTER|CENTRE|HALL|GYM|HOSPITAL|MULTI-PURPOSE|MULTIPURPOSE|OFFICE/i;

export function normalizeCategory(p: Pick<RawProject, 'componentCategories' | 'category' | 'description'>): Category {
  const cc = p.componentCategories;
  if (cc) {
    if (/Flood/i.test(cc)) return 'flood';
    if (/Roads|Bridges/i.test(cc)) return 'roads';
    if (/Buildings/i.test(cc)) return 'buildings';
    return 'other';
  }
  const text = `${p.category ?? ''} ${p.description ?? ''}`;
  if (FLOOD_RE.test(text)) return 'flood';
  if (ROAD_RE.test(text)) return 'roads';
  if (BUILDING_RE.test(text)) return 'buildings';
  return 'other';
}

// ---------- Status ----------

export type Status = 'completed' | 'ongoing' | 'procurement' | 'notstarted' | 'terminated' | 'unknown';

export function normalizeStatus(s: string | null): Status {
  switch ((s ?? '').toLowerCase().replace(/[^a-z]/g, '')) {
    case 'completed':
      return 'completed';
    case 'ongoing':
      return 'ongoing';
    case 'forprocurement':
      return 'procurement';
    case 'notyetstarted':
      return 'notstarted';
    case 'terminated':
      return 'terminated';
    default:
      return 'unknown';
  }
}

// ---------- Contractors ----------
// Format: "NAME (12345)", "NAME ([REVOKED] 12345)", joint ventures "A (1) / B (2)".
// The number is the PCAB licence number and is our contractor id.

export interface ContractorRef {
  id: string; // PCAB number, or 'n-<slug>' when missing
  name: string;
  revoked: boolean;
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function parseContractors(raw: string | null): ContractorRef[] {
  if (!raw || !raw.trim()) return [];
  // Split on " / " only where the left part ends with a "(… digits)" group, so names containing "/" survive.
  const parts = raw.split(/(?<=\((?:\[[A-Z]+\]\s*)?\d+\))\s*\/\s*/);
  return parts
    .map((part) => {
      const m = part.match(/^(.*?)\s*\((\[[A-Z]+\]\s*)?(\d+)\)\s*$/);
      if (m) return { id: m[3], name: cleanName(m[1]), revoked: !!m[2] && /REVOKED/.test(m[2]) };
      const name = cleanName(part);
      return { id: `n-${slug(name)}`, name, revoked: false };
    })
    .filter((c) => c.name.length > 0);
}

function cleanName(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// ---------- Location text ----------
// Descriptions usually end with "..., <MUNICIPALITY>, <PROVINCE>". We extract candidate
// place-name tokens from the tail and let the matcher decide which are real LGU names.

export function normName(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ñ/g, 'N')
    .replace(/\bSTA\.?\s/g, 'SANTA ')
    .replace(/\bSTO\.?\s/g, 'SANTO ')
    .replace(/\bGEN\.?\s/g, 'GENERAL ')
    .replace(/\bPRES\.?\s/g, 'PRESIDENT ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comma-separated segments of the description, last first, normalised. */
export function tailSegments(description: string, max = 4): string[] {
  return description
    .split(/[,;]/)
    .map((s) => normName(s))
    .filter(Boolean)
    .reverse()
    .slice(0, max);
}

/** DEO name "Davao Oriental 2nd DEO" → "DAVAO ORIENTAL"; "Region XI" / "Central Office" → null. */
export function deoProvince(deo: string | null): string | null {
  if (!deo) return null;
  const m = deo.match(/^(.*?)\s+(?:\d+(?:st|nd|rd|th)\s+)?(?:Sub-)?DEO\b/i);
  return m ? normName(m[1]) : null;
}
