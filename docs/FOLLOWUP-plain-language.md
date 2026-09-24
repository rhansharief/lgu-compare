# Follow-up: make the LGU page readable by a non-expert

Context: a first read of `/lgu/1102509000/?peer=class&period=last3` by a citizen (not a data person) — most numbers were not understood. The data is right; the explanation layer is missing. Goal of this pass: every number on the page should be readable by someone who has never heard of "poverty incidence" or "PSGC", without changing the data pipeline.

Rule for all copy below: plain words, one short sentence, no acronyms without expansion on first use. Filipino-English register (e.g. "town", "money", "per person").

## 1. Stat tiles — add a one-line "what this means" under each

- **Spend per resident** → "Total DPWH project cost in this town over the period, divided by its population. Higher = more national infrastructure money per person."
- **Poverty incidence** → "Share of people living below the poverty line (PSA). Higher = poorer. This is our measure of *need*."
- **Top-3 contractor share** → "How much of the money went to just the 3 biggest contractors. Higher = more concentrated."
- **Completion rate** → "Finished projects ÷ projects with a known status. Recent periods look low because new projects are still on-going."

Implement as a muted secondary line inside the tile, always visible (not a tooltip — mobile users won't find it).

## 2. Poverty tile: make direction and data caveat unmistakable

- The delta currently reads "▲ 8.5 pts since 2021". Up = worse here. Change to "Worse by 8.5 pts since 2021" (or "Better by X pts") and color with the status palette: worse = critical/red text + icon, better = good/green text + icon. Never rely on the arrow alone.
- Move "Figure for all of Davao Oriental. PSA's city/municipal estimates aren't loaded yet." from fine print to a visible warning chip *inside the tile* ("Province-wide figure") until municipal poverty data is loaded. Apply the same chip to every LGU whose poverty figure is province-level.
- Same chip logic on the scatter: the note about dots lining up vertically should be near the chart title, not below the chart.

## 3. Rank wording

- Ranks should read in the direction a citizen expects.
  - Spend per resident: "1st of 10 — highest in the peer group".
  - Top-3 contractor share: replace "8th of 10 (1st = most concentrated)" with "Less concentrated than 7 of 9 peers" / "More concentrated than N of M peers". Drop the parenthetical.
  - Completion rate: "Lower than 6 of 9 peers" style.
- Keep the peer median line, but phrase it: "Typical peer: ₱21,916".

## 4. Headline sentence

- Add an auto-generated 1–2 sentence summary directly under the page title, built from the tiles. Template:
  "Over {period}, {LGU} received about {ratio}× the national infrastructure money per person that similar {class/region} {cities|towns} did, mostly for {top category}, {spread across N contractors | concentrated in 3 contractors}. {Poverty sentence: 'Poverty in {scope} got worse/better by X pts since {year}.'}"
- Round ratio to one decimal ("about 1.9×"); if within 0.9–1.1× say "about the same".
- This sentence is also the `<meta description>` and the share-card text.

## 5. Glossary page `/glossary`

Short entries, 2–3 sentences each, linked from every term's first occurrence (dotted underline):
- Poverty incidence (and poverty line)
- Income class (1st–6th class; what it's based on)
- PSGC (Philippine Standard Geographic Code — the ID number for every region/province/town/barangay)
- Budget (infra) year vs. actual construction year
- DPWH, District Engineering Office
- Peer group (why we compare to similar LGUs, not the whole country)
- "Placed" / confidence (high / medium / low) — plain description of how a project was assigned to a town
- Joint venture split rule

## 6. Period filter clarity

- Under the period chips, one line: "Money is counted by the year it was budgeted, not when the road was built. The latest year always looks unfinished."
- On the completion tile, when period includes the current year, add: "{N} of these projects are from {current year} and still on-going."

## 7. Quadrant labels on the scatter

- Replace the four corner labels with fuller phrasing: "Poorer, gets more money" / "Poorer, gets less money" / "Better-off, gets more money" / "Better-off, gets less money".
- Tooltip on each dot: LGU name, province, spend per person, poverty (with "(province-wide)" when applicable), population.

## 8. Contractor table

- Add a one-line intro: "Who was paid to build the projects above. Share = their slice of all DPWH money in this town for the period."
- Contractor names are ALL CAPS from the source — title-case them for display, keep raw name in the tooltip / link.

## 9. Small things

- "Placed: high/medium" column in the projects table → rename header to "Confidence" and add a tooltip explaining it; or hide by default and show in the coverage section.
- "PSGC 1102509000" in the header → link to the glossary entry.
- Sources block: prefix with "Where the numbers come from".

## Acceptance check

Hand the page to someone who has not seen the project, ask them to say in one sentence what it says about Mati. If they can't, the pass isn't done.
