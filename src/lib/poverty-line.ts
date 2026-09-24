// The PSA poverty line behind a poverty figure, shown in the poverty card's Details.
// PSA publishes it per person per year; it reports the headline figure as "a month for a family of five"
// (e.g. ₱13,873 nationally in 2023), which is the yearly per-person figure × 5 ÷ 12.

export interface PovertyLine {
  /** Pesos a month for a family of five, rounded. */
  monthly: number;
  year: number;
  /** Area the line was set for: the province, the city, or "the Philippines". */
  area: string;
  /** PSA table the figure comes from. */
  source: string;
}

export function monthlyForFamilyOfFive(annualPerPerson: number): number {
  return Math.round((annualPerPerson * 5) / 12);
}

/** Label → year → yearly per-person threshold, from PSA OpenSTAT Table 2a (CSV rows as mirrored in data/raw/psa). */
export function parseThresholds(csv: string): { rows: Map<string, Map<number, number>>; source: string } {
  const rows = new Map<string, Map<number, number>>();
  let source = '';
  for (const line of csv.split(/\r?\n/)) {
    const f = [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    if (!f[1]?.startsWith('Annual Per Capita Poverty Threshold')) continue;
    const v = Number(f[3]);
    if (!f[3] || !Number.isFinite(v)) continue;
    if (!rows.has(f[0])) rows.set(f[0], new Map());
    rows.get(f[0])!.set(Number(f[2]), v);
    source ||= f[6] ?? '';
  }
  return { rows, source };
}
