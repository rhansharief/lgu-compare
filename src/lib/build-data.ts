// Build-time access to the emitted index (read once per build, not once per page).
import { readFileSync } from 'node:fs';
import { cleanGeoLabel, placeKey } from '../../pipeline/psa.ts';
import { monthlyForFamilyOfFive, parseThresholds, type PovertyLine } from './poverty-line.ts';
import type { LguIndexRow } from './metrics.ts';

export const buildIndex = JSON.parse(readFileSync('public/data/index.json', 'utf8'));

// Same PSA table the pipeline reads poverty incidence from, so the line matches the figure's area and year.
const thresholds = parseThresholds(readFileSync('data/raw/psa/openstat_f19c15d14ad2f3c9023e_poverty_pop_prov_huc_2018_2021_2023.csv', 'utf8'));
const byPlace = new Map<string, Map<number, number>>();
let national: Map<number, number> | undefined;
for (const [label, years] of thresholds.rows) {
  const { depth, name } = cleanGeoLabel(label);
  if (depth === 0 && /^PHILIPPINES/.test(name)) national = years;
  else if (depth >= 4) byPlace.set(placeKey(name), years);
}

/** The poverty line for the area and year of an LGU's poverty figure; the national line when the area isn't found. */
export function povertyLineFor(l: Pick<LguIndexRow, 'name' | 'prov' | 'pov' | 'povYear' | 'povLevel'>): PovertyLine | null {
  if (l.pov == null || l.povYear == null) return null;
  const local = byPlace.get(placeKey(l.povLevel === 'lgu' ? l.name : l.prov))?.get(l.povYear);
  const annual = local ?? national?.get(l.povYear);
  if (annual == null) return null;
  return {
    monthly: monthlyForFamilyOfFive(annual),
    year: l.povYear,
    area: local == null ? 'the Philippines' : l.povLevel === 'lgu' ? l.name : l.prov,
    source: thresholds.source,
  };
}
