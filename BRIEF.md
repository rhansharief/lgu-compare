# Project Brief — Infra Money Tracker (working name: lgu-compare)

Personal, non-profit, public civic-tech project by Farhan. Not affiliated with BetterGov.PH or bettermati.com; it *consumes* BetterGov.PH's public APIs and credits them.

## The one question

**Does national infrastructure money go where it's needed — and who's getting it?**

Every page, chart and feature must serve that question. If a feature doesn't help answer it, leave it out.

## What it is

A static website where you type in a Philippine city/municipality and see:

1. how much national infrastructure (DPWH) money was spent there, per resident, in a chosen period;
2. how that compares with *similar* LGUs (peer group), not the whole country;
3. whether spend tracks need (poverty incidence, later flood exposure);
4. which contractors got the money and how concentrated that is.

## What it is NOT

- Not an "LGU performance" ranking. No overall score. No "better/worse LGU" language.
- Not about individual politicians. Never "Mayor X got ₱2B". Always "during period X, DPWH spent ₱2B in LGU Y".
- Not local (LGU-funded) spending. National DPWH money only. Say so clearly on the site.
- Not a BetterGov project. Footer: "Data from BetterGov.PH APIs and PSA. Not affiliated."
- No accounts, no backend, no database at runtime.

## Data sources (verified Sept 2026)

| Need | Source | Notes |
|---|---|---|
| DPWH projects: cost, category, contractor, status, location, dates | `https://api.dpwh.bettergov.ph` (DPWH Transparency API) and `https://flood-control.bettergov.ph` | Root URL 404s — find the actual endpoint docs / OpenAPI spec first. Locations are likely free text → needs PSGC mapping. |
| Population, poverty incidence by LGU | `https://statistics.bettergov.ph/api` (`/api/v1/datasets`, `/datasets/{id}/query`, `/api/classification` for PSGC hierarchy reg/prv/mun/bgy) | Check per dataset whether it is published at municipal level. Poverty may only be province/city level for some years. Limits: 5,000 points per query. |
| PSGC codes | `statistics.bettergov.ph/api/classification` or PSA PSGC CSV | Canonical key for every LGU. |
| National admin / election periods | Hard-code: Duterte 2016-07 → 2022-06, Marcos Jr. 2022-07 →. Local terms: 3 yrs starting July 1 of election years (2019, 2022, 2025). | Optionally `https://dynasties.bettergov.ph` API for who held office — **out of scope for v1** (separate dynasties case study later). |
| Flood hazard exposure (later) | UP NOAH / PAGASA | v2 only. Second "need" axis for flood-control category. |

Budget API (`budget.bettergov.ph/docs`) is national-level only (department → agency → program; region rollup in NEP 2027). No LGU breakdown → not used in v1.

## Core metrics (per LGU, per period)

- `spend_total` — sum of DPWH project cost in the LGU
- `spend_per_resident` — spend_total / population
- `spend_by_category` — flood control / roads & bridges / buildings / other
- `project_count`, `completion_rate` (completed / total with known status)
- `top3_contractor_share` — share of spend_total won by the top 3 contractors
- `poverty_incidence` — latest PSA figure available at LGU level, with year
- `peer_rank_*` — rank of each metric within the selected peer group
- `data_coverage` — % of projects that could be mapped to this LGU; show it, never hide it

## Peer groups (user-selectable)

- Same income class + same island group (default)
- Same region
- Similar population (±30%)
- Whole country

Peer group stays fixed when the period changes, so period comparisons are apples-to-apples.

## Periods (user-selectable)

`Latest year` · `Last 3 years` · `Marcos Jr. admin (2022-07→)` · `Duterte admin (2016-07→2022-06)` · `Custom range`
Use budget years fully inside the period. Show a "coverage note" for the current period (money approved lags projects by 1–2 years — don't let it read as "nothing happened").

## Pages / views (build in this order)

### 1. LGU page — `/lgu/{psgc}`
- Header: name, province, region, income class, population.
- Chips: peer group, period.
- 4 stat tiles: spend per resident (+rank, peer median, delta vs previous period), poverty incidence (+change), top-3 contractor share (+rank), project completion rate.
- Category breakdown (horizontal bars).
- Top contractors table with share.
- Project list (sortable, links to contractor pages).
- Data coverage note.

### 2. Need vs money scatter — `/compare`
- Every LGU in the peer group as a dot. x = poverty incidence, y = spend per resident. Dot size = population. Color = at most 3 groups (e.g. region vs rest), never more.
- Dashed lines at peer medians → 4 quadrants, labelled ("higher need · less money" etc.).
- Search box highlights your LGU; hover tooltip on every dot.
- Filters: peer group, period, category (all / flood control / roads / buildings).
- This is the shareable chart. Add a "copy link" that encodes the filters in the URL.

### 3. Contractor page — `/contractor/{id}`
- Total awarded, project count, LGUs operated in (map or list), share of each LGU's spend.
- Cross-link back to LGU pages.

### Later (v2)
- Term-over-term slope chart (each peer LGU as a line, previous period → current period).
- Flood exposure as a second need axis for the flood-control category.
- Map view (choropleth by metric).

## Build shape

- **Static site**, prebuilt from the APIs by a scheduled job (nightly or weekly). Output = JSON per LGU + per contractor + one index. No runtime backend.
- Suggested stack: TypeScript. Astro or Next.js static export for pages; D3 or Observable Plot for charts (plain SVG, no chart-library black boxes). Node script for the data pipeline. Deploy on Cloudflare Pages / GitHub Pages / Vercel.
- Pipeline steps: `fetch` (raw API dumps, cached to disk) → `map` (PSGC join) → `aggregate` (metrics per LGU × period) → `emit` (JSON for the site).
- Commit the raw dumps' checksums and the mapping table; make the whole build reproducible.
- **First milestone:** the PSGC mapping table (`data/psgc-map.csv`: raw DPWH location string → PSGC code, with confidence). This is the hard part and blocks everything. Publish it under CC0 in this repo — it's useful on its own.
- **First test case:** Mati City, Davao Oriental (PSGC to confirm). Sanity-check every number by hand before building the second page.

## Visual / UX rules

- One question per chart. Every number shown with its peer context ("₱13,400 per resident · 6th of 32 · peer median ₱7,900"), never alone.
- Thin marks, recessive gridlines, direct labels for the highlighted LGU only, legend for ≥2 series, hover tooltips everywhere, table view available for every chart.
- Max 3 categorical colors on any scatter. Sequential = one hue. Status colors only for status.
- Mobile-first: the scatter must be readable on a phone.
- Light and dark mode.
- See `docs/mockup.png` for the intended look of the compare view (sample data, not real figures).

## Wording rules (important — this is political data)

- Periods, not people. "During the Marcos Jr. administration, DPWH spent…" not "Marcos gave…".
- No causal claims. "Spend does not track poverty in this peer group" is fine; "corruption" is not.
- Always show the denominator, the peer group, and the data coverage.
- Cite sources with dates on every page.

## Open questions for the first coding session

1. ~~Find the real DPWH API endpoints and response shape (root 404s).~~ **Resolved → [docs/dpwh-api.md](docs/dpwh-api.md)**; sample dump in `data/raw/dpwh/`.
2. ~~Which PSA datasets have poverty incidence at municipal level?~~ **None on statistics.bettergov.ph** (provinces + HUCs only, 2018/2021/2023). v1 uses the province figure, labelled; drop PSA SAE into `data/raw/psa/sae_municipal.csv` to upgrade → [docs/psa-sources.md](docs/psa-sources.md).
3. ~~Does DPWH data include lat/lng?~~ **Yes for ~81% (unverified).** Join = description text + point-in-polygon → 95.0% of projects mapped → `data/psgc-map.csv`.
4. Rate limits / terms of use for the BetterGov APIs.
