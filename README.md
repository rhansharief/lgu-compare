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

## Architecture: what is stored where, and why

The whole site is prebuilt files. There is no backend, no database and no API call at runtime. The data only changes
when DPWH publishes new projects, and a weekly rebuild keeps up with that. Static files are free to host, have no server
to break or attack, and don't slow down when a link gets shared widely. Each page is built as a shell. The browser then
loads the numbers from JSON, so switching the peer group or the period (all kept in the URL) needs no server.

The pipeline is four steps, and each writes files to disk, so any step can be rerun without repeating the ones
before it. What each set of files is and why it is or isn't committed:

| Files | Size | In git? | Why |
|---|---|---|---|
| `data/raw/dpwh/pages/` (raw DPWH API pages) | ~200 MB | No | Too big to commit, and replaced every week. Kept on disk so the rest of the pipeline reruns in ~10 s instead of refetching for 15–20 min. That also keeps load off BetterGov's free API. |
| `data/raw/dpwh/manifest.json`, `PAGES.SHA256SUMS` | small | Yes | Record when the fetch ran, how many rows it got and a checksum of every page. A rebuild can be checked against exactly the input that was published. |
| `data/raw/psa/`, `data/raw/boundaries/` | ~26 MB | Yes | Small and rarely updated. psa.gov.ph blocks scripted downloads, so committing a copy keeps builds reproducible even if the source moves. |
| `data/psgc-map.csv` (each contract → city or municipality) | ~39 MB, 265k rows | Yes, CC0 | The part of this project nobody else publishes, and the one worth checking. Each row shows how a contract was placed and how confident the match is. Committed, a change to the matcher or new DPWH data shows up as a readable diff, and others can reuse it. Still under GitHub's 100 MB file limit. |
| `data/build/aggregate.json` | ~230 MB | No | Intermediate. Rebuilt from the raw pages and the mapping in seconds. |
| `public/data/` (what the site reads) | ~160 MB | No | Generated. CI rebuilds it before each deploy, so committing it would only add weekly churn. |

`public/data/` is split so no page downloads much more than it shows:

- `index.json` (~1.3 MB): one row of metrics for every city and municipality. Every page needs it, because comparing with
  peers means knowing all of them. It is fetched once and cached.
- `search.json` (~100 KB): names only. Loaded when you click into the search box, not on page load.
- `lgu/{psgc}.json`: one file per place (1,642) with its project list, so a city page loads only its own projects.
- `contractor/{00–ff}.json`: 6,646 contractors hashed into 256 files (`src/lib/buckets.ts`). That keeps both the number
  of files and the size of each one small. The browser computes the same hash to find which file to load.

`vercel.json` lets browsers cache `/data/*` for an hour and keep using a stale copy for up to a day while they
recheck. Anything longer would hide the weekly refresh.

## Deploy (Vercel)

First deploy, from a machine with the data built:

```bash
npx vercel link
npx vercel build --prod && npx vercel deploy --prebuilt --prod --archive=tgz
```

`--archive=tgz` uploads the ~10k built files as one archive. Without it, the free plan's limit of 5,000 file uploads a
day stops the deploy partway.

Weekly refresh: `.github/workflows/refresh.yml` refetches, rebuilds, commits the updated mapping table and checksums,
and deploys with `vercel deploy --prebuilt`. It needs the repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and
`VERCEL_PROJECT_ID`; the last two are in `.vercel/project.json` after `vercel link`. The site JSON (~160 MB) isn’t
committed. It is rebuilt in CI.

## License

Code: MIT. `data/psgc-map.csv`: CC0.
