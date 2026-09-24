# Follow-up 2: citizen-first page — questions, not metric names

The first plain-language pass (FOLLOWUP-plain-language.md) added explanations *under* the jargon. That is not enough: a citizen still meets "Poverty incidence", "peer median", "income class", "PSGC" before anything makes sense. This pass removes the jargon from the default view. Technical labels and figures stay, but move into a collapsed "Details" layer.

Principle: **every section leads with a question a normal person would ask, answered in one plain sentence.** The number supports the sentence; it is not the headline. Words like "incidence", "median", "peer", "concentration", "PSGC", "budget year", "LGU" do not appear in the default view.

## 1. Stat tiles → question cards

Replace the four tiles with four cards. Each card = question (title) · plain answer (large text) · comparison line · optional caveat chip · `Details ▸` disclosure containing the current technical content (label, exact figure, rank, median, formula).

**Card 1 — "How much national road and flood money came here?"**
- Answer: "₱42,622 for every person in Mati" (spend per resident; always "for every person in {LGU}").
- Comparison: "About {ratio}× what similar cities got." Rules: ≥1.15 → "About N× what similar cities got"; 0.85–1.15 → "About the same as similar cities"; <0.85 → "About N× less than similar cities" — phrase as "Less than half of…" when ratio < 0.5.
- Second line: "Up ₱16,624 per person from the previous 3 years." / "Down…"
- Details: "₱6.34B total DPWH project cost ÷ 148,672 people (2024). 1st of 10 in the comparison group; typical: ₱21,916."

**Card 2 — "How poor is this place?"**
- Answer: "About {N} in 10 people are poor." Derive N = round(incidence/10); when incidence < 5% say "Fewer than 1 in 20". Never show "incidence" in the default view.
- Comparison: "More than most similar cities." / "Fewer than most similar cities." / "About the same as similar cities." (from rank vs median).
- Trend: "Got worse since 2021." / "Got better since 2021." with status color + icon.
- Caveat chip (when province-level): "Figure for the whole province of Davao Oriental." Keep visible.
- Details: "Poverty incidence 38.9% (2023), was 30.4% in 2021. PSA counts a person as poor when their family earns less than the poverty line — the minimum needed for food and basic needs (about ₱{threshold} a month for a family of five in {year}; pull the actual threshold from PSA and cite it). Typical similar city: 26.5%."

**Card 3 — "Did a few companies get most of the money?"**
- Answer: "No — the 3 biggest got 38%." Rules: top-3 share ≥ 75% → "Yes — the 3 biggest got X%"; 50–75% → "Mostly — the 3 biggest got X%"; <50% → "No — the 3 biggest got X%".
- Second line: "{N} companies got work in total."
- Comparison: "More spread out than most similar cities." / "More concentrated than most similar cities."
- Details: current label, rank, median, joint-venture rule.

**Card 4 — "How much of it is actually finished?"**
- Answer: "67 of 150 projects are done."
- Second line: "{N} of the rest started in {latest year} and are still being built." / "{N} haven't started yet."
- Comparison: "Fewer finished than most similar cities — but most of Mati's projects are new." (append the "new" clause when >50% of unfinished projects are from the latest year in the period).
- Details: completion rate %, rank, median, formula.

## 2. Page header

- Keep the generated headline sentence but rewrite in the same register. No "income class", no "peer". Example:
  "Over the last 3 years, Mati got about twice the national road-and-flood money per person that similar cities in Mindanao got — mostly for roads, spread across 44 companies. Meanwhile, poverty in Davao Oriental province got worse: about 4 in 10 people are now poor."
- Sub-line: "City in Davao Oriental · 148,672 people". Move "5th income class · Region XI · PSGC …" into a `Details` disclosure.
- The "Only national projects of DPWH…" note → one plain line: "This counts only money from the national government (DPWH). Money the city spends from its own budget is not included."

## 3. Filters

- "Compare with" options → "Similar cities in Mindanao" (default), "Cities in the same region", "Places with a similar population", "Every city and town in the country".
- "Period" options → "This year", "Last 3 years", "Under the current president (since July 2022)", "Under the previous president (2016–2022)", "Pick years".
- The budget-year note → "We count money by the year it was approved, not when the road was built. The newest year always looks unfinished."

## 4. Scatter

- Title: "Do poorer places get more money?"
- Subtitle: "Each dot is one city. Further right = poorer. Higher up = more money per person. Mati is the black dot."
- Axis labels: "Poorer →" and "↑ More money per person". Ticks keep numbers.
- Quadrant labels stay as in pass 1.
- Province-wide chip stays; reword: "For 9 of these 10 cities we only know the poverty figure for their whole province, so cities in the same province sit in a vertical line."
- Legend: "Mati", "Same region as Mati", "Other similar cities".

## 5. Peer table → "Similar cities side by side"

- Column headers: "City", "Money per person", "How many are poor", "Share won by top 3 companies".
- Poverty cell: "4 in 10 (38.9%)".
- Footnote: "The 6 similar cities closest in population to Mati. The grey bar shows the range across all 10; the tick is the typical value."

## 6. Category section → "What was the money for?"

- Category labels: "Flood control", "Roads and bridges", "Schools, halls and other buildings", "Water and other".
- Each bar: "₱4.11B — ₱27,639 per person" and a comparison "more/less than similar cities".

## 7. Contractors → "Which companies got paid?"

- Intro: "The companies hired to build the projects. 'Share' is their slice of all the national money spent in Mati in this period."

## 8. Projects → "Every project, one by one"

- "Confidence" column → hide by default; show inside a "How sure are we these are in Mati?" disclosure at the bottom together with the current data-coverage text, reworded: "DPWH doesn't say which town a project is in. We worked it out from the project's name and its map location. 354 of 448 projects here are a confident match."

## 9. Sources → "Where the numbers come from"

Keep, plain wording.

## 10. Glossary

Keep the page, but it is now a fallback: nothing in the default view should *require* it. Link it from Details disclosures only.

## Acceptance check

Show the page to someone who does not know what "poverty incidence" or "median" means. They should be able to answer, without help: How much money came here? Is that a lot? Are people here poor? Did one company get everything? Is the work finished? If any answer needs the glossary, the pass isn't done.
