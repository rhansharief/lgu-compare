# City/municipality boundaries (PSGC Adm3)

Checked and built on 2026-09-24.

## What's in the repo

| File | Purpose |
|---|---|
| `data/raw/boundaries/ph-municities-2023.geojson` | One GeoJSON FeatureCollection with every city and municipality. WGS84 lon/lat. |
| `data/raw/boundaries/build-boundaries.mjs` | Rebuilds the file from source: it downloads, checks the sha256, simplifies with mapshaper, joins names and recodes to Q2_2024. |
| `data/raw/boundaries/verify-boundaries.mjs` | Sanity checks and known-point tests. It has no dependencies. |

- **Size:** 18.3 MB, sha256 `b74e4662eff31b25a7527fa4587f07da42cdd892ce4da7b136e5b0001c9cc22f`. This is under GitHub's 50 MB warning, so it can be committed.
- **Features:** 1,642 (149 City + 1,493 Mun). The PSGC codes match `data/raw/psa/psgc_Q2_2024_income_classification.json` exactly: none are missing and none are extra.
- **Geometry:** 5% Visvalingam simplification with `keep-shapes`, done in the source UTM 51N CRS and then reprojected to WGS84. Coordinates are rounded to 1e-5° (about 1 m).
- **Rebuild:** `node data/raw/boundaries/build-boundaries.mjs [--simplify 10%]`. It needs `unzip` and network access, and it runs `npx mapshaper@0.7.66`. It downloads a 318 MB zip into the OS temp dir. `--simplify 10%` gives about 36 MB.
- **Verify:** `node data/raw/boundaries/verify-boundaries.mjs`.

### Feature properties

```json
{"psgc":"1102509000","psgc_2023":"1102509000","name":"City of Mati","geo_level":"City",
 "province_psgc":"1102500000","province_name":"Davao Oriental","adm2_psgc_src":"1102500000",
 "region_psgc":"1100000000","region_name":"Region XI (Davao Region)","area_km2":709}
```

- **`psgc`:** a **10-digit PSGC string** using the Q2_2024 coding, zero-padded (for example `0102801000` for Adams). Use it as the join key.
- **`psgc_2023`:** the code as it appears in the Dec-2023 source. It differs from `psgc` only for the NIR LGUs (see gotchas).
- **Source format:** the source stores codes as *numbers*, so the leading zero is lost (`102801000`). The script pads them. The old 9-digit "correspondence code" format (for example `112509000` for Mati) is **not** included. If a dataset uses it, join through `correspondence_code` in the PSA PSGC files.
- **`province_psgc` / `province_name`:** these are `null` for the 17 non-NCR HUCs, which sit outside any province (Angeles, Olongapo, Lucena, Bacolod, Iloilo, Cebu, Lapu-Lapu, Mandaue, Tacloban, Zamboanga, Cagayan de Oro, Iligan, Davao, General Santos, Baguio, Butuan, Puerto Princesa). For NCR LGUs these fields hold the NCR district.
- **`adm2_psgc_src`:** the source's own adm2 value, kept unchanged.

## Source

- **Dataset:** altcoder/philippines-psgc-shapefiles, file `dist/PH_Adm3_MuniCities.shp.zip`. It is stored in git-lfs: 317,781,224 bytes, sha256 `9bb847cf…9027c2`.
  - https://github.com/altcoder/philippines-psgc-shapefiles, pinned at commit `a44a73091f19e4950dbdc0d7cb77a5e17b101a0a` (2024-09-17, "fix: municity mapping of NCR and Davao City").
  - Download URL: `https://media.githubusercontent.com/media/altcoder/philippines-psgc-shapefiles/<commit>/dist/PH_Adm3_MuniCities.shp.zip`
  - Province and region names come from `dist/PH_Adm2_ProvDists.csv` and `dist/PH_Adm1_Regions.csv` at the same commit.
- **License:** MIT (per the repo's LICENSE file). The underlying geometry comes from public NAMRIA/PSA-derived boundaries, and the maintainer says it has been updated for each PSGC change. Credit it as "Boundaries: altcoder/philippines-psgc-shapefiles (MIT), PSGC as of 31 Dec 2023."
- **PSGC vintage:** 31 Dec 2023 (4Q 2023). Two later changes are applied in the build script (see gotchas).

### Candidates considered

| Candidate | Verdict |
|---|---|
| **faeldon/philippines-json-maps** `2023/geojson/provdists/{low,med,hi}res/municities-provdist-*.json` (MIT, the same altcoder source already simplified) | Rejected. The 88 per-province files hold only **1,618** features. The 16 non-NCR HUCs are missing because each HUC is its own "provdist" and has no file at this level. The SGA file (`1909900000`) is an empty GeometryCollection. Each province was also simplified separately, so the shared edges between provinces don't match. |
| **HDX COD-AB `cod-ab-phl`** (NAMRIA/PSA, CC BY-IGO, updated 2026-08) | Not used. It only ships as large zips: gdb 361 MB, shp 929 MB, geojson 1.06 GB. It would need GDAL or heavy processing, and CC BY-IGO is less simple than MIT. Worth a look if newer boundaries are needed later. The contents were not inspected. |
| **BetterGov.PH** | The GitHub org has no canonical PSGC boundary dataset. Its apps (bettergov map, flood-watch, open-data-visualization) use boundaries for display only. Not investigated further. |

## Accuracy check

- **Test points:** 215,796 DPWH project coordinates from `data/raw/dpwh/pages/*` were checked with point-in-polygon. A brute-force bbox prefilter plus ray casting took about 6.6 s in Node.
  - **Full resolution (311 MB):** 1,557 points (0.72%) fell in no polygon.
  - **10%:** 1,572 points fell in no polygon.
  - **5% (this file):** 1,634 points (0.76%) fell in no polygon.
  - No point fell in more than one polygon.
  - Most unassigned points are genuinely offshore or in water: coastal roads, ports, Laguna de Bay, Manila Bay reclamation.
- **Random sample:** 5,000 random land points were assigned against full resolution. 1 of them landed in the wrong polygon at 5%.
- **Recommendation:** fall back to the *nearest* polygon (for example within 2 km) for unassigned points, and cross-check against the project's `location.province` / DEO text.
- **Required test:** (6.9726049, 126.3074728) falls in **City of Mati `1102509000`**, and only there. Spot checks for Manila, Quezon City, Cotabato City, Isabela City and Davao City also pass.

## Gotchas

1. **Negros Island Region (NIR, RA 12000, 2024).** The source is Dec-2023, so Negros Occidental (`06045…`), Negros Oriental (`07046…`), Siquijor (`07061…`) and Bacolod City (`0630200000`) still carry Region VI/VII codes there. PSA Q2_2024 recoded them to `18045…`, `18046…`, `18061…` and `1830200000` in region `1800000000`. The build script rewrites the prefixes (63 LGUs) and keeps the old code in `psgc_2023`. **DPWH or other data may use either coding, so join on both.**
2. **BARMM Special Geographic Area (SGA, `1999900000`).** The source has 8 "clusters" of barangays (Carmen Cluster, Pikit Cluster I, …). In 2024 these became 8 municipalities under the same codes `1999901000`–`1999908000`: Kapalawan, Old Kaabakan, Kadayangan, Nabalawag, Pahamuddin, Malidegao, Ligawasan and Tugunan. The script renames them (the old name is in `name_2023`). Cluster polygons are used as-is, which may not exactly match the final municipal boundaries. The SGA is geographically inside Cotabato province (Region XII), but its code belongs to BARMM.
3. **Cotabato City** is `1908703000`, under Maguindanao del Norte in BARMM. Older data (before 2022/2023) has it in Region XII, with codes like `1298…` or `129804000`. The source already reflects the 2022 Maguindanao split into del Norte (`19087`) and del Sur (`19088`).
4. **Isabela City** is `0990101000`: Region IX, adm2 `0990100000` "City of Isabela (Not a Province)". Geographically it sits on Basilan island (BARMM), so a region-by-geography check will look wrong. Don't confuse it with **Isabela municipality** in Negros Occidental (`1804514000`, formerly `0604514000`) or **Isabela province** in Region II (`0203100000`).
5. **NCR.** Each of the 16 cities plus Pateros is one polygon. The **14 Manila sub-municipalities** (Tondo, Sampaloc and others, `geographic_level` SubMun in PSA) are *not* split out; they only exist at Adm4. The source's adm2 for NCR cities is the city itself. The script fills in `province_psgc` / `province_name` with the NCR district:
   - 1st District (`1303900000`): Manila
   - 2nd District (`1307400000`): Mandaluyong, Marikina, Pasig, QC, San Juan
   - 3rd District (`1307500000`): Caloocan, Malabon, Navotas, Valenzuela
   - 4th District (`1307600000`): Las Piñas, Makati, Muntinlupa, Parañaque, Pasay, Pateros, Taguig
6. **Makati/Taguig "EMBO" barangays.** Ten barangays moved from Makati to Taguig after the 2023 Supreme Court ruling. Check which side the source puts them on before trusting spend in the Makati/Taguig area. This was not verified.
7. **Sulu.** A 2024 Supreme Court ruling excluded Sulu from BARMM. PSA Q2_2024 still codes it `1906600000` (BARMM), and so does this file. Watch later PSGC releases for a recode.
8. **HUCs** have no province (`province_psgc = null`). Davao City sits geographically in Davao del Sur, Cebu City in Cebu, and so on. Use a separate mapping if you need the geographic province.
9. **Names.** They are trimmed; some source names had trailing spaces, like PSA's "City of Mati ". Examples: "City of Mati", "Quezon City", "Pasay City". The PSA JSON in `data/raw/psa/` has **mojibake** such as "PeÃ±ablanca", which is UTF-8 read as Latin-1. Fix it with `Buffer.from(s,'latin1').toString('utf8')` before comparing names, or better, join on code only.
10. **Changes after Q2_2024** (city conversions, new municipalities from 2025 onward) are not reflected. Re-run the PSA cross-check in `verify-boundaries.mjs` against any newer PSGC list.
