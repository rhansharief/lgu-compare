# DPWH API — endpoints & response shape

Resolves BRIEF open question 1. Probed 2026-09-24.

## What it is

`https://api.dpwh.bettergov.ph` is a Redis-caching Express proxy (source: [bettergovph/api.dpwh](https://github.com/bettergovph/api.dpwh), MIT) in front of the official DPWH Transparency Portal API at `https://civic.transparency.dpwh.gov.ph`. There is no OpenAPI spec, and `/` returns 404 by design. `flood-control.bettergov.ph` ([bettergovph/flood-watch](https://github.com/bettergovph/flood-watch)) mirrors the same `/projects` feed into PostGIS and adds nothing we need.

## Endpoints

| Endpoint | Notes |
|---|---|
| `GET /projects` | Paginated list. Envelope: `{status, code, data: {data: [...], summary, pagination}}` |
| `GET /projects/{contractId}` | Detail: adds bidders, procurement (ABC, award date/amount), components with coordinates, document links. Envelope: `{status, code, data: {...}}` |
| `GET /health` | Service status |

### `/projects` query params (verified)

| Param | Works | Example | Notes |
|---|---|---|---|
| `page`, `limit` | ✅ | `limit=5000` | 5000 is accepted (the upstream scraper's default). ~265.5k projects in total = 54 pages |
| `search` | ✅ | `search=MATI` | Substring match on text. `MATI` also hits MATINA, AUTOMATIC… (1,485 rows) |
| `province` | ✅ | `province=Davao%20Oriental` | **Plain province name**, not the DEO name (`Davao Oriental 1st DEO` → 0 rows) |
| `region` | ✅ | `region=Region%20XI` | |
| `status` | ✅ | `status=Completed` | |
| `category` | ✅ | `category=Flood%20Control%20and%20Drainage` | |
| `year` | ✅ | `year=2024` | Filters on `infraYear` |
| `infraYear`, `q`, `deo`, `contractor`, `sort*`… | ❌ | | **Silently ignored: the API returns the full dataset.** The pipeline must assert on `pagination.totalCount`. |

## List-item shape

```jsonc
{
  "contractId": "20LG0027",            // stable key
  "description": "CONCRETING OF … , CITY OF MATI , DAVAO ORIENTAL",  // free text, usually ends "<MUN>, <PROVINCE>"
  "category": "Roads",                 // messy: 60+ values in Davao Oriental alone, incl. fund codes like "GAA 2025 SSP"
  "componentCategories": "Roads",
  "status": "Completed",               // Completed | Ongoing | Not Yet Started | For Procurement | Terminated
  "budget": 23740923.27,               // PHP; = award amount in detail
  "amountPaid": 0,                     // always 0 in Davao Oriental: unusable
  "progress": 100,
  "location": { "province": "Davao Oriental 2nd DEO", "region": "Region XI" },  // DEO, NOT municipality
  "contractor": "RANGAY CONSTRUCTION AND SUPPLY (40117)",  // "(n)" = PCAB id → contractor key
  "startDate": "2020-11-24", "completionDate": "2021-05-16",
  "infraYear": "2020",
  "programName": "Regular Infra", "sourceOfFunds": "Regular Infra - GAA 2020 LP",
  "latitude": 6.9726049, "longitude": 126.3074728,   // nullable; unverified
  "isLive": false, "livestreamUrl": null, "reportCount": 0, "hasSatelliteImage": true
}
```

Joint ventures and multiple bidders appear in detail `bidders[]` (with `pcabId`, `isWinner`). Detail `location.coordinates.verified` and `components[].coordinates.locationVerified` were `false` for the sample.

## Implications for the pipeline

1. **Q3 answered (partly): lat/lng exists but is incomplete.** 436 of 2,305 Davao Oriental rows (19%) have null coordinates, and none are marked verified. PSGC join = point-in-polygon on municipal boundaries **plus** a text parse of the description's trailing `<MUN>, <PROVINCE>`. Keep both results and a confidence value.
2. Text alone misleads: road names like `MATI-MARAGUSAN RD` sit in Lupon. A rough bounding box also catches Banaybanay, Lupon and San Isidro. So we need real boundary polygons.
3. `category` needs a normalisation table → the brief's 4 buckets (flood control / roads & bridges / buildings / other).
4. Use `budget` for spend. `amountPaid` is useless.
5. Fetch strategy: 54 × `limit=5000` pages, cached to disk. Origin latency is about 7s per request (`cfCacheStatus: DYNAMIC`). No rate-limit headers are returned; open question 4 still needs a check of the terms.
6. `totalCount` drifted between calls (265,477 to 265,530) during this session, so the dataset is live. Snapshot and checksum each run.

## Sample dump — Mati City (`data/raw/dpwh/`)

| File | What |
|---|---|
| `projects_province-davao-oriental.json` | Raw `?province=Davao Oriental&limit=5000` — 2,305 projects, 2016–2026 |
| `projects_search-mati.json` | Raw `?search=MATI&limit=5000` — 1,485 rows (noisy, see above) |
| `sample_mati-city.json` | **Candidate** subset: description matches `CITY OF MATI \| MATI CITY \| MATI, DAVAO OR` → 330 projects, ₱7.24B budget, all under the Davao Oriental 2nd DEO; 241 of them have lat/lng. Not a verified total. |
| `project-detail_sample.json` | Raw `/projects/20LG0027` |
| `SHA256SUMS` | Checksums |
