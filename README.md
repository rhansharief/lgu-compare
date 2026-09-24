# Infra Money Tracker (lgu-compare)

**Does national infrastructure money go where it's needed, and who's getting it?**

A static site: type in a Philippine city or municipality and see how much national DPWH infrastructure money was
spent there per resident, how that compares with similar LGUs, whether spend tracks poverty, and which contractors
got the contracts. See [BRIEF.md](BRIEF.md) for the full spec and wording rules.

Data from BetterGov.PH APIs and PSA. Not affiliated.

## Quick start

```bash
npm install
npm run fetch      # ~15–20 min: downloads all ~265k DPWH projects to data/raw/dpwh/pages (gitignored)
npm run pipeline   # map → aggregate → emit (~10 s): writes data/psgc-map.csv and public/data/
npm test           # parsers, text matcher, metrics
npm run dev        # http://localhost:4321
npm run build      # static site in dist/ (~8k pages)
```

## Pipeline

| Step | Script | Output |
|---|---|---|
| fetch | `pipeline/fetch.ts` | `data/raw/dpwh/pages/*.json` + `manifest.json` + `PAGES.SHA256SUMS` |
| map | `pipeline/map.ts` | **`data/psgc-map.csv`**: every contract → PSGC city/municipality, with method and confidence (CC0) |
| aggregate | `pipeline/aggregate.ts` | `data/build/aggregate.json` (intermediate) |
| emit | `pipeline/emit.ts` | `public/data/index.json`, `search.json`, `lgu/{psgc}.json`, `contractor/{bucket}.json`, `psgc-map.csv` |

Reference data committed under `data/raw/`:
- `psa/`: PSGC Q2 2024 list (income class, population) and PSA poverty incidence, from statistics.bettergov.ph. See [docs/psa-sources.md](docs/psa-sources.md).
- `boundaries/`: municipal boundary polygons keyed by 10-digit PSGC. See [docs/boundaries-source.md](docs/boundaries-source.md).

How the DPWH API works: [docs/dpwh-api.md](docs/dpwh-api.md). The Mati City hand-check: [docs/mati-sanity-check.md](docs/mati-sanity-check.md).

### Adding municipal poverty estimates

PSA's city/municipal Small Area Estimates aren't on the BetterGov API, and psa.gov.ph blocks scripted downloads.
Download the latest release by hand from <https://psa.gov.ph/statistics/poverty-sae>. Save it as
`data/raw/psa/sae_municipal.csv` with columns `psgc,year,poverty_incidence` (10-digit PSGC), then run `npm run pipeline`.
Those figures then replace the province-level fallback, and the site labels them as the LGU's own.

## Site

Astro static output, [Observable Plot](https://observablehq.com/plot/) for the scatter, and plain HTML/CSS for everything else.

- `/`: search and overview
- `/lgu/{psgc}/`: LGU page (tiles with peer rank and median, need-vs-money chart, closest peers, categories, contractors, projects, data coverage)
- `/compare/`: need vs. money scatter for a peer group. Every filter is in the URL (`?lgu=&peer=&period=&cat=&scale=log`)
- `/contractor/{pcab-id}/`: contractor page
- `/about/`: method, definitions and limitations

Metric logic lives in `src/lib/metrics.ts` and is shared with the tests.

## Deploy (Vercel)

First deploy, from a machine with the data built:

```bash
npx vercel link
npx vercel build --prod && npx vercel deploy --prebuilt --prod
```

Weekly refresh: `.github/workflows/refresh.yml` refetches, rebuilds, commits the updated mapping table and checksums,
and deploys with `vercel deploy --prebuilt`. It needs the repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and
`VERCEL_PROJECT_ID`; the last two are in `.vercel/project.json` after `vercel link`. The site JSON (~120 MB) isn't
committed. It is rebuilt in CI.

## License

Code: MIT. `data/psgc-map.csv`: CC0.
