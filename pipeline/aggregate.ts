// Step 3: aggregate mapped projects into per-LGU and per-contractor figures.
// Output: data/build/aggregate.json (intermediate, not committed).
import { mkdirSync, writeFileSync } from 'node:fs';
import { CATEGORIES, PERIODS, PRESET_IDS, type Category, type YearRow } from '../src/lib/metrics.ts';
import { normalizeCategory, normalizeStatus, parseContractors, type Status } from './parse.ts';
import { DPWH_REGION, loadLgus, loadPoverty } from './psa.ts';
import { loadMap, loadRawProjects, type Confidence, type Method } from './raw.ts';

export interface Project {
  id: string;
  desc: string;
  cat: Category;
  status: Status;
  budget: number; // 0 when missing
  year: number | null;
  contractors: { id: string; name: string; revoked: boolean }[];
  psgc: string | null;
  method: Method | null;
  conf: Confidence | null;
  start: string | null;
  end: string | null;
  program: string | null;
  regCode: number | null;
}

export function toProjects(): Project[] {
  const map = loadMap();
  return loadRawProjects().map((p) => {
    const m = map.get(p.contractId);
    const y = Number(p.infraYear);
    return {
      id: p.contractId,
      desc: p.description?.trim() ?? '',
      cat: normalizeCategory(p),
      status: normalizeStatus(p.status),
      budget: p.budget && p.budget > 0 ? p.budget : 0,
      year: Number.isInteger(y) && y > 2000 ? y : null,
      contractors: parseContractors(p.contractor),
      psgc: m?.psgc ?? null,
      method: m?.method ?? null,
      conf: m?.confidence ?? null,
      start: p.startDate,
      end: p.completionDate,
      program: p.sourceOfFunds ?? p.programName,
      regCode: p.location?.region ? DPWH_REGION[p.location.region] ?? null : null,
    };
  });
}

/** Spend per contractor. Joint-venture contracts are split equally between partners. */
export function contractorSpend(projects: Pick<Project, 'budget' | 'contractors'>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of projects) {
    if (!p.budget || !p.contractors.length) continue;
    const share = p.budget / p.contractors.length;
    for (const c of p.contractors) out.set(c.id, (out.get(c.id) ?? 0) + share);
  }
  return out;
}

/** Share of total spend won by the 3 biggest contractors (spend with no contractor listed counts in the denominator). */
export function top3Share(projects: Pick<Project, 'budget' | 'contractors'>[]): number | null {
  const total = projects.reduce((s, p) => s + p.budget, 0);
  if (total <= 0) return null;
  const top = [...contractorSpend(projects).values()].sort((a, b) => b - a).slice(0, 3);
  return top.reduce((s, x) => s + x, 0) / total;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lgus = loadLgus();
  const pov = loadPoverty(lgus);
  const projects = toProjects();
  console.log(`${projects.length} projects, ${projects.filter((p) => p.psgc).length} mapped`);

  const byLgu = new Map<string, Project[]>();
  for (const p of projects) if (p.psgc) (byLgu.get(p.psgc) ?? byLgu.set(p.psgc, []).get(p.psgc)!).push(p);

  const lguOut = lgus.map((l) => {
    const ps = byLgu.get(l.psgc) ?? [];
    const y: Record<string, YearRow> = {};
    for (const p of ps) {
      if (!p.year) continue;
      const r = (y[p.year] ??= [0, 0, 0, 0, 0, 0, 0]);
      r[CATEGORIES.indexOf(p.cat)] += p.budget;
      r[4] += 1;
      if (p.status === 'completed') r[5] += 1;
      if (p.status !== 'unknown') r[6] += 1;
    }
    for (const r of Object.values(y)) for (let i = 0; i < 4; i++) r[i] = Math.round(r[i]);
    const top3: Record<string, number | null> = {};
    for (const id of [...PRESET_IDS, 'prev-latest', 'prev-last3']) {
      const per = PERIODS.find((p) => p.id === id)!;
      const s = top3Share(ps.filter((p) => p.year && p.year >= per.from && p.year <= per.to));
      top3[id] = s == null ? null : Math.round(s * 1000) / 1000;
    }
    const conf = { high: 0, medium: 0, low: 0 };
    for (const p of ps) if (p.conf) conf[p.conf] += 1;
    const pv = pov.get(l.psgc);
    return {
      ...l,
      pov: pv?.value ?? null,
      povYear: pv?.year ?? null,
      povLevel: pv?.level ?? null,
      povPrev: pv?.prevValue ?? null,
      povPrevYear: pv?.prevYear ?? null,
      y,
      top3,
      conf,
      projects: ps,
    };
  });

  // Coverage by DPWH region: share of projects (count and value) placed in some city/municipality.
  const coverage: Record<number, { n: number; mapped: number; value: number; mappedValue: number }> = {};
  const national = { n: 0, mapped: 0, value: 0, mappedValue: 0 };
  for (const p of projects) {
    for (const c of [p.regCode != null ? (coverage[p.regCode] ??= { n: 0, mapped: 0, value: 0, mappedValue: 0 }) : null, national]) {
      if (!c) continue;
      c.n++;
      c.value += p.budget;
      if (p.psgc) { c.mapped++; c.mappedValue += p.budget; }
    }
  }

  // Contractors
  const contractors = new Map<string, { id: string; names: Map<string, number>; revoked: boolean; projects: Project[] }>();
  for (const p of projects) {
    for (const c of p.contractors) {
      const e = contractors.get(c.id) ?? contractors.set(c.id, { id: c.id, names: new Map(), revoked: false, projects: [] }).get(c.id)!;
      e.names.set(c.name, (e.names.get(c.name) ?? 0) + 1);
      e.revoked ||= c.revoked;
      e.projects.push(p);
    }
  }

  mkdirSync('data/build', { recursive: true });
  writeFileSync(
    'data/build/aggregate.json',
    JSON.stringify({
      lgus: lguOut,
      coverage,
      national,
      unmappedProjects: projects.filter((p) => !p.psgc).length,
      contractors: [...contractors.values()].map((c) => ({
        id: c.id,
        name: [...c.names].sort((a, b) => b[1] - a[1])[0][0],
        aliases: [...c.names.keys()],
        revoked: c.revoked,
        projectIds: c.projects.map((p) => p.id),
      })),
      projects,
    }),
  );
  console.log(`LGUs with spend: ${lguOut.filter((l) => l.projects.length).length}/${lguOut.length}; contractors: ${contractors.size}`);
  console.log(`national coverage: ${((100 * national.mapped) / national.n).toFixed(1)}% of projects, ${((100 * national.mappedValue) / national.value).toFixed(1)}% of value`);
}
