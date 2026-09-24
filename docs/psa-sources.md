# PSA data sources (verified 2026-09-24)

All raw files are in `data/raw/psa/`. Every value quoted here came from an actual response.

## API mechanics (statistics.bettergov.ph)

- Docs: `https://statistics.bettergov.ph/api.md`, `https://statistics.bettergov.ph/llms.txt`, OpenAPI at `https://statistics.bettergov.ph/api/v1/openapi.json` (`/docs` and `/openapi.json` return 404).
- Search: `GET /api/v1/datasets?q=<words>&limit=<1-200>&offset=<n>&ready=true&sort=...`. It uses `q`, not `search` or `page`. Pagination is in `pagination.nextOffset`, which is null on the last page. The whole catalog has 3,582 datasets (`/api/v1/coverage`).
- Dimension codes: `GET /api/v1/datasets/{id}/values?dimension=<code>&release=<release>&limit=200&offset=n`.
- Query: **POST** (not GET) `/api/v1/datasets/{id}/query[?format=csv]` with the JSON body `{"release": "<meta.release>", "selection": {"<dimCode>": ["0","1",...], ...}}`. Every dimension must be listed. Codes are positional string indices ("0", "1", ...), not PSGC codes. The limit is 5,000 points per query. The `release` value comes from `GET /api/v1/datasets/{id}`. A stale release returns HTTP 409.
- CSV output starts with a UTF-8 BOM. Columns: `Geolocation/Geographic Location, <param>, [Year], Value, Source status, Release, Source`.
- Python `urllib` with its default User-Agent gets **HTTP 403**. `curl` works.
- The download method for each dataset: fetch the metadata and all dimension values, split the largest dimension into chunks so each query stays at or under 5,000 cells, send a POST with `format=csv` per chunk, then concatenate the chunks with one header. Each `*.meta.json` file holds the metadata plus the full code→label lists.

## 1. Poverty incidence

**No city/municipal-level poverty (SAE) data is available on the mirror or on OpenSTAT.**
- Catalog-wide scan (all 3,582 datasets): no poverty or poor-related dataset has a geography dimension with 150 or more members. `q=small area` returns 0 results.
- OpenSTAT itself (`https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/1F`) has only the FS, FY and BS folders. FY Tables 1–16 go down to Region/Province/HUC at the finest.
- PSA publishes the 2023 (and 2021) city/municipal SAE on `https://psa.gov.ph/statistics/poverty-sae`. A web search snippet says it covers 14 Manila sub-municipalities, 114 cities and 1,483 municipalities. Every psa.gov.ph URL returns **HTTP 403 with a Cloudflare "Just a moment..." challenge** to curl and to the embedded browser, so it could not be downloaded or verified here. It must be downloaded manually in a normal browser.

**Best available: province + HUC, poverty incidence among population**

| File | Dataset id | Title (short) | Geo | Years | Rows |
|---|---|---|---|---|---|
| `openstat_f19c15d14ad2f3c9023e_poverty_pop_prov_huc_2018_2021_2023.csv` | `f19c15d14ad2f3c9023e` | Table 2a. Annual Per Capita Poverty Threshold and Poverty Incidence Among Population with Measures of Precision, by Region, Province and HUCs | 142 (PH, regions, NCR districts, provinces, HUCs) | 2018, 2021, 2023 | 2,556 |
| `openstat_b4a71a27b4e4189c79a8_poverty_pop_prov_2018_2021_2023.csv` | `b4a71a27b4e4189c79a8` | Table 2 (same, Region/Province only) | 108 | 2018, 2021, 2023 | 1,944 |
| `openstat_649a0c0e51467f9694d4_poverty_pop_prov_2006_2015.csv` | `649a0c0e51467f9694d4` | Annual Per Capita Poverty Threshold, Poverty Incidence and Magnitude of Poor Population by Region/Province (older series) | 103 | 1991 (empty), 2006, 2009, 2012, 2015 | 2,060 |

- Source for f19c: `https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__1F__FY/0041F3DF02A.px`, release `2026-08-03T13-49-16-ffb070b97929`.
- Parameters in f19c: Annual Per Capita Poverty Threshold (PhP), Poverty Incidence among Population (%), Coefficient of Variation, Standard Error, 95% CI Lower, 95% CI Upper.
- Philippines, among population: 16.7 (2018), 18.1 (2021), 15.5 (2023).
- Gotchas:
  - Geography is keyed by **label text only**, not PSGC. Labels carry dot-indentation for depth (`..` region, `....` province/HUC/district, `......` Maguindanao del Norte/Sur) and footnote suffixes such as `"....Davao Oriental 1/, 2/"` or `"PHILIPPINES r1, 1/, 2/, 3/"`. Strip both before joining.
  - Provinces that contain an HUC are shown *excluding* it, for example "Davao del Sur (w/o the City of Davao)".
  - Table 2 spells the CI labels "Limits" and Table 2a spells them "Limit".
  - The 2006–2015 series uses the older methodology and depth markers (`..Davao Oriental b/`). Do not mix it with the 2018+ series.

## 2. Population by city/municipality

| File | Dataset id | Parameters | Geo | Rows |
|---|---|---|---|---|
| `openstat_05c931eaecec498f9756_pop_landarea_density_2015_2020_2024.csv` | `05c931eaecec498f9756` | 2015/2020/2024 Population, Land Area (km²), density 2015/2020/2024, % change in density | 1,744 | 17,440 |
| `openstat_b951ab6afce93188e716_pop_growth_2010_2024.csv` | `b951ab6afce93188e716` | Total Population 1 May 2010 / 1 Aug 2015 / 1 May 2020 / 1 Jul 2024, growth rates 2010-15, 2015-20, 2015-24, 2020-24 | 1,744 | 13,952 |

- Sources: `https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__1A__PO_2024/0221A6DLPD0.px` and `.../0211A6DAPG0.px`, release `2026-08-12T09-17-54-...`.
- Includes the 2020 Census and the 2024 POPCEN (reference date 1 July 2024).
- Geography levels, from the leading dots: 1 national, 18 at `..` (regions), 117 at `....` (provinces, HUCs, NCR cities and Pateros, SGA), 1,608 at `......` (component cities and municipalities).
  - The LGU universe is the 1,608 `......` rows plus the 17 NCR LGUs and 17 non-NCR HUCs at `....`, which gives 1,642 LGUs. That matches PSGC's 1,493 Mun + 149 City.
- Gotchas:
  - Keyed by **name only**. 114 municipality names are duplicated across provinces (Dolores, La Paz, San Isidro, ...), so joins must go through the parent province, which is the nearest preceding `....` row.
  - Footnote suffixes also appear here ("City of Makati  1/", "Negros Occidental  4/*").
- Regional barangay-level 2024 POPCEN tables also exist (for example `6cd21aca348d99253bf2` for Region XI). They were not downloaded.

## 3. PSGC list with income class & city type

Source: `https://statistics.bettergov.ph/api/classification/psgc/Q2_2024/{level}?page_size=1000`, following `next`. This mirrors `classification.psa.gov.ph`. The manifest is at `/api/classification/manifest.json`. Versions available: Q2_2021, Q4_2023, April_2024, Q2_2024 (latest on the mirror). `psgc/.../all` is unavailable.

| File | Count | Levels |
|---|---|---|
| `psgc_Q2_2024_regions.json` | 18 | Reg |
| `psgc_Q2_2024_provinces.json` | 117 | 82 Prov, 33 City (HUCs), 2 blank (City of Isabela "Not a Province", Special Geographic Area) |
| `psgc_Q2_2024_municipalities.json` | 1,623 | 1,493 Mun, 116 City (component/independent component), 14 SubMun (Manila) |
| `psgc_Q2_2024_city_class.json` | 149 | City: CC 111, HUC 33, ICC 5 |
| `psgc_Q2_2024_income_classification.json` | 1,724 | 82 Prov + 149 City + 1,493 Mun. **This is the best single LGU list.** |

- Fields: `code` (10-digit PSGC, string), `correspondence_code` (9-digit legacy code), `area_name`, `geographic_level`, `reg`, `prv`, `mun`, `bgy` (integers), `city_class`, `income_classification`, `island_region`, `status` ("Capital"), `populations` (2015/2020/2024).
- Gotchas:
  - 80 `area_name` values have trailing spaces, for example "City of Mati ".
  - Population values are strings with commas and surrounding spaces (`" 147,547 "`).
  - 66 entries have only 2024 population and 20 have only 2015/2020, probably because of boundary changes. Not verified per row.
  - Income class values include `1st`–`6th`, `*` variants (e.g. `4th*`), `1st (as Mun)`, `1st* (reclass 2005)`, `Special` (Manila, Quezon City) and `-` (29 rows). The asterisk meaning was not verified.
  - The region name for a row is not embedded in it. Join on `reg`, or on the first 2 digits of `code`, to the regions file. Province is `code[:5]` + `00000`. HUCs have their own province-level code and are not under a province.
  - Geographic codes are "not necessarily unique" per the API docs.
- **PSA PSGC publication Excel**: `https://psa.gov.ph/classification/psgc`. A web search surfaced `https://psa.gov.ph/system/files/scd/PSGC-4Q-2025-Publication-Datafile.xlsx` and `.../PSGC-1Q-2025-Publication-Datafile.xlsx`. Both return **HTTP 403 (Cloudflare challenge)** to curl, so neither was downloaded or verified. A newer quarter than Q2_2024 (for example 4Q 2025, with newer income classes) would need a manual browser download.

## Mati City (Davao Oriental) check

| Source | Result |
|---|---|
| PSGC Q2_2024 | code `1102509000` (corr. `112509000`), "City of Mati ", level City, city_class **CC**, income_classification **5th**, status Capital, pop 2015 141,141 / 2020 147,547 / 2024 148,672. Province Davao Oriental `1102500000` (1st class), Region XI `1100000000`. |
| Population `05c931eaecec498f9756` | `......City of Mati`: 2015 141,141; 2020 147,547; 2024 148,672; land area 633.05 km² |
| Population `b951ab6afce93188e716` | 2010 126,143; 2015 141,141; 2020 147,547; 2024 148,672; growth 2020–24 0.18 |
| Poverty (city level) | **Not available.** Mati is a component city, so it is not broken out in Table 2a. |
| Poverty (Davao Oriental province, `f19c...`/`b4a7...`) | among population 37.7% (2018, CV 6.2), 30.4% (2021, CV 7.7), 38.9% (2023, CV 5.7) |
| Poverty (Davao Oriental, `649a...`, old series) | 50.50 (2006), 54.41 (2009), 45.79 (2012), 29.88 (2015, CV 21.99) |
