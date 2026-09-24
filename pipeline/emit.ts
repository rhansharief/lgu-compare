// Step 4: write the JSON the static site reads, into public/data/.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { contractorBucket } from '../src/lib/buckets.ts';
import type { LguIndexRow } from '../src/lib/metrics.ts';
import type { Project } from './aggregate.ts';

const OUT = 'public/data';
const agg = JSON.parse(readFileSync('data/build/aggregate.json', 'utf8'));
const manifest = JSON.parse(readFileSync('data/raw/dpwh/manifest.json', 'utf8'));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/lgu`, { recursive: true });
mkdirSync(`${OUT}/contractor`, { recursive: true });

const projectById = new Map<string, Project>(agg.projects.map((p: Project) => [p.id, p]));
const lguName = new Map<string, { name: string; prov: string }>(agg.lgus.map((l: any) => [l.psgc, { name: l.name, prov: l.prov }]));

const sources = {
  dpwh: { name: 'DPWH Transparency Portal via BetterGov.PH API', url: 'https://api.dpwh.bettergov.ph/projects', fetched: manifest.fetchedAt.slice(0, 10), rows: manifest.rowsOnDisk },
  psgc: { name: 'PSA PSGC Q2 2024 (income class, population) via statistics.bettergov.ph', url: 'https://statistics.bettergov.ph/api/classification/psgc/Q2_2024/income_classification', fetched: '2026-09-24' },
  poverty: { name: 'PSA poverty incidence among population, 2018/2021/2023 (provinces & HUCs) via statistics.bettergov.ph', url: 'https://statistics.bettergov.ph/datasets/f19c15d14ad2f3c9023e', fetched: '2026-09-24' },
};

// ---------- index.json ----------
const index: (LguIndexRow & { conf: Record<string, number>; n: number })[] = agg.lgus.map((l: any) => ({
  psgc: l.psgc,
  name: l.name,
  prov: l.prov,
  reg: l.reg,
  island: l.island,
  kind: l.kind,
  cls: l.cls,
  pop: l.pop,
  pov: l.pov,
  povYear: l.povYear,
  povLevel: l.povLevel,
  povPrev: l.povPrev,
  povPrevYear: l.povPrevYear,
  y: l.y,
  top3: l.top3,
  conf: l.conf,
  n: l.projects.length,
}));
const regionCoverage: Record<string, { n: number; mapped: number; value: number; mappedValue: number }> = {};
for (const l of agg.lgus) regionCoverage[l.reg] ??= agg.coverage[l.regCode] ?? { n: 0, mapped: 0, value: 0, mappedValue: 0 };

writeFileSync(
  `${OUT}/index.json`,
  JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), sources, national: agg.national, regionCoverage, lgus: index }),
);
writeFileSync(`${OUT}/search.json`, JSON.stringify(index.map((l) => ({ psgc: l.psgc, name: l.name, prov: l.prov }))));

// ---------- lgu/{psgc}.json ----------
// Projects as compact tuples: [id, desc, cat, status, budget, year, contractorIds, conf, method, start, end]
for (const l of agg.lgus) {
  const contractorNames: Record<string, string> = {};
  const rows = (l.projects as Project[])
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.budget - a.budget)
    .map((p) => {
      for (const c of p.contractors) contractorNames[c.id] = c.name;
      return [p.id, p.desc, p.cat, p.status, Math.round(p.budget), p.year, p.contractors.map((c) => c.id), p.conf, p.method, p.start, p.end];
    });
  writeFileSync(`${OUT}/lgu/${l.psgc}.json`, JSON.stringify({ psgc: l.psgc, contractors: contractorNames, projects: rows }));
}

// ---------- contractor buckets ----------
// All-years spend per LGU, for "share of each LGU's spend".
const lguTotal = new Map<string, number>();
for (const l of agg.lgus) lguTotal.set(l.psgc, (l.projects as Project[]).reduce((s, p) => s + p.budget, 0));

const buckets = new Map<string, Record<string, unknown>>();
for (const c of agg.contractors) {
  const ps = (c.projectIds as string[]).map((id) => projectById.get(id)!).filter(Boolean);
  let total = 0, mappedTotal = 0;
  const byLgu = new Map<string, { spend: number; n: number }>();
  for (const p of ps) {
    const share = p.budget / Math.max(1, p.contractors.length);
    total += share;
    if (p.psgc) {
      mappedTotal += share;
      const e = byLgu.get(p.psgc) ?? byLgu.set(p.psgc, { spend: 0, n: 0 }).get(p.psgc)!;
      e.spend += share;
      e.n += 1;
    }
  }
  const lgus = [...byLgu]
    .map(([psgc, e]) => ({ psgc, name: lguName.get(psgc)?.name, prov: lguName.get(psgc)?.prov, spend: Math.round(e.spend), n: e.n, share: lguTotal.get(psgc) ? Math.round((1000 * e.spend) / lguTotal.get(psgc)!) / 1000 : null }))
    .sort((a, b) => b.spend - a.spend);
  const b = contractorBucket(c.id);
  if (!buckets.has(b)) buckets.set(b, {});
  buckets.get(b)![c.id] = {
    id: c.id,
    name: c.name,
    aliases: c.aliases.length > 1 ? c.aliases : undefined,
    revoked: c.revoked || undefined,
    total: Math.round(total),
    mappedTotal: Math.round(mappedTotal),
    n: ps.length,
    jv: ps.filter((p) => p.contractors.length > 1).length,
    lgus,
    projects: ps
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.budget - a.budget)
      .map((p) => [p.id, p.desc, p.cat, p.status, Math.round(p.budget), p.year, p.psgc, p.contractors.length]),
  };
}
for (const [b, data] of buckets) writeFileSync(`${OUT}/contractor/${b}.json`, JSON.stringify(data));

copyFileSync('data/psgc-map.csv', `${OUT}/psgc-map.csv`);
console.log(`emitted ${index.length} LGUs, ${agg.contractors.length} contractors in ${buckets.size} buckets`);
