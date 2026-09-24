# Mati City sanity check

First test case from the brief. Done 2026-09-24 against the DPWH snapshot of the same day (265,439 projects).
Every figure the site shows for Mati was recomputed independently in Python, straight from the raw page dumps and
`data/psgc-map.csv`, without going through the TypeScript pipeline.

## Identity

| | Value | Source |
|---|---|---|
| PSGC | `1102509000` | PSGC Q2 2024 |
| Kind / class | Component city, 5th income class, provincial capital | PSGC Q2 2024 |
| Population | 148,672 (2024) | PSGC Q2 2024; 147,547 in 2020 |
| Poverty incidence | 38.9% (2023), 30.4% (2021): **Davao Oriental province figure** | PSA via statistics.bettergov.ph |

## Mapping

448 projects placed in Mati across 2016–2026:

| Method | Projects |
|---|---|
| text and coordinates agree | 255 |
| text only | 99 |
| coordinates only | 87 |
| text and coordinates disagree (text used) | 7 |

The text rule checks the end of the description, so "MATI-MARAGUSAN ROAD, LUPON" goes to Lupon, not Mati. That case is covered in `pipeline/match.test.ts`.

## Last 3 years (budget years 2023–2025)

| Metric | Site | Independent recount |
|---|---|---|
| Projects | 150 (55 / 52 / 43 by year) | 150 |
| Total project cost | ₱6.34B | ₱6,336,637,058 |
| Spend per resident | ₱42,622 | 6,336,637,058 ÷ 148,672 = 42,622 |
| Top-3 contractor share | 38% | 0.376 |
| Completion rate | 45% (67 of 150) | 67 completed, 81 on-going, 2 for procurement |

The largest contracts, all naming Mati City in the description:
- Access road to the Mati fish port: phases 1 to 4, ₱143M to ₱284M each.
- Fish port multi-purpose facility: ₱143M.
- Matiao–Magsaysay coastal road: ₱191M.
- Road in Barangay Don Salvador Lopez: ₱143M.
- Flood mitigation structure, Barangay Mayo: ₱116M.

## Peer context (default peer group)

Only 3 fifth-class cities exist in Mindanao, so the "same class" group widens to **4th–6th class cities, Mindanao**:
10 cities outside BARMM (Isabela, Oroquieta, Tangub, El Salvador, Samal, Mati, Tacurong, Cabadbaran, Bayugan, Tandag).
Mati ranks 1st of 10 on spend per resident for 2023–2025. Peer median: ₱21,916.

## Caveats found

- Poverty is province-level, so Mati and all 10 Davao Oriental municipalities show the same 38.9%. City-level SAE figures would fix this (see README).
- A single fish-port programme (5 contracts, about ₱860M) makes up about 14% of Mati's 2023–25 total, so per-resident figures for small LGUs can swing on one programme. The project list shows this directly.
