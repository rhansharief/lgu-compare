import {
  CATEGORIES, CATEGORY_LABEL, SEPARATE_NOTE, SEPARATE_REGION, completionRate, fmtPct, fmtPeso, fmtPesoCompact, median, ordinal, peerLabel, peers,
  perResident, prevOf, rankDesc, standing, standingPhrase, totals, type Category, type PeriodDef,
} from '../metrics.ts';
import { periodChipLabel, renderControls } from './controls.ts';
import { esc, loadIndex, loadLgu, STATUS_LABEL, type IndexFile, type IndexRow, type LguFile, type LguProject } from './data.ts';
import { legendHtml, renderScatter, type Point } from './scatter.ts';
import { ICON, provWarning } from './ui.ts';
import { contractorCount, headline } from '../headline.ts';
import { term } from '../terms.ts';
import {
  categoryComparison, companiesLine, completionAnswer, completionComparison, groupWords, povertyAnswer, povertyCell, povertyComparison, povertyTrend,
  shortName, sinceWords, spendChange, spendComparison, top3Answer, top3Comparison, unfinishedLine,
} from '../answers.ts';
import type { PovertyLine } from '../poverty-line.ts';
import { linkFirstTerms } from './terms.ts';
import { titleCase } from '../names.ts';
import { periodOf, readState, writeState, type ViewState } from './state.ts';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

export async function initLguPage(psgc: string, povertyLine: PovertyLine | null) {
  const state = readState({ peer: 'class', period: 'last3' });
  const [index, lguFile] = await Promise.all([loadIndex(), loadLgu(psgc)]);
  const me = index.lgus.find((l) => l.psgc === psgc)!;
  const update = () => {
    writeState(state, ['peer', 'period', 'from', 'to']);
    render(index, me, lguFile, state, povertyLine);
  };
  const cities = me.kind === 'City' ? 'cities' : 'towns';
  renderControls($('#controls'), state, {
    peerLabels: {
      class: `Similar ${cities} in ${me.island}`,
      region: `Cities and towns in ${me.reg}`,
      pop: 'Places with a similar population',
      country: me.reg === SEPARATE_REGION ? 'Every city and town in BARMM' : 'Every city and town in the country',
    },
  }, update);
  update();
  let w = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - w) > 40) { w = window.innerWidth; update(); } });
  window.addEventListener('themechange', update);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
}

/** JV contracts split equally between partners. */
function contractorTable(projects: LguProject[]) {
  const m = new Map<string, { spend: number; n: number }>();
  for (const p of projects) {
    const ids = p[6];
    if (!ids.length) continue;
    for (const id of ids) {
      const e = m.get(id) ?? m.set(id, { spend: 0, n: 0 }).get(id)!;
      e.spend += p[4] / ids.length;
      e.n += 1;
    }
  }
  return [...m].map(([id, e]) => ({ id, ...e })).sort((a, b) => b.spend - a.spend);
}

/** Collapsed technical layer under each card and section. Glossary links live only in here. */
const details = (html: string) => `<details class="details"><summary>Details</summary><div class="details-body">${html}</div></details>`;

/** Keep open Details blocks open when a section re-renders (filters, resize, theme). */
function keepOpen(el: HTMLElement, html: string) {
  const open = [...el.querySelectorAll('details')].map((d) => d.open);
  el.innerHTML = html;
  el.querySelectorAll('details').forEach((d, i) => { if (open[i]) d.open = true; });
}

/** Contractor names are ALL CAPS in the source: show them title-cased, keep the raw name as the tooltip. */
function contractorLink(file: LguFile, id: string) {
  const raw = file.contractors[id] ?? id;
  return `<a href="/contractor/${esc(id)}/" title="${esc(raw)}">${esc(titleCase(raw))}</a>`;
}

function top3Share(projects: LguProject[]): number | null {
  const total = projects.reduce((s, p) => s + p[4], 0);
  if (!total) return null;
  return contractorTable(projects).slice(0, 3).reduce((s, c) => s + c.spend, 0) / total;
}

function inPeriod(p: LguProject, per: Pick<PeriodDef, 'from' | 'to'>) {
  return p[5] != null && p[5] >= per.from && p[5] <= per.to;
}

function top3For(l: IndexRow, per: PeriodDef): number | null {
  return per.id in l.top3 ? l.top3[per.id] : null;
}

function render(index: IndexFile, me: IndexRow, file: LguFile, state: ViewState, line: PovertyLine | null) {
  const per = periodOf(state);
  const prev = prevOf(per);
  const group = peers(me, index.lgus, state.peer);
  const others = group.length - 1;
  const short = shortName(me.name);
  const gw = groupWords(state.peer, me); // "similar cities"
  const noun = state.peer === 'class' ? (me.kind === 'City' ? ['city', 'cities'] : ['town', 'towns']) : ['city or town', 'cities and towns'];
  $('#peer-count').textContent = `compared with ${others} ${state.peer === 'class' ? 'similar' : 'other'} ${noun[others === 1 ? 0 : 1]}`;
  const periodName = per.id in me.top3 ? periodChipLabel(per.id) : per.label;
  const groupNote = `Comparison group (${term('peer-group', 'peer group')}): ${esc(peerLabel(state.peer, me, index.lgus))}, ${group.length} places including ${esc(short)}.`;

  const T = (l: IndexRow) => totals(l, per);
  const myT = T(me);
  const pr = (l: IndexRow) => perResident(T(l).spend, l.pop);
  const myPr = pr(me);
  const peerPr = group.map(pr);
  const prRank = rankDesc(myPr, peerPr);
  const prMed = median(peerPr.filter((x): x is number => x != null));

  const periodProjects = file.projects.filter((p) => inPeriod(p, per));
  const nCompanies = contractorCount(file.projects, per);
  const summary = headline({
    me, all: index.lgus, mode: state.peer, per,
    top3: per.id in me.top3 ? me.top3[per.id] : top3Share(periodProjects),
    contractors: nCompanies,
  });
  $('#headline').textContent = summary;
  for (const sel of ['meta[name="description"]', 'meta[property="og:description"]']) document.querySelector(sel)?.setAttribute('content', summary);
  const isPreset = per.id in me.top3;
  const myTop3 = isPreset ? top3For(me, per) : top3Share(periodProjects);
  const peerTop3 = isPreset ? group.map((l) => top3For(l, per)) : [];
  const top3Med = isPreset ? median(peerTop3.filter((x): x is number => x != null)) : null;

  const myComp = completionRate(myT);
  const peerComp = group.map((l) => completionRate(T(l)));
  const compMed = median(peerComp.filter((x): x is number => x != null));

  const peerPov = group.map((l) => l.pov);
  const povMed = median(peerPov.filter((x): x is number => x != null));

  // Comparisons need someone to compare with.
  const cmp = (x: string) => (others > 0 && x ? `<p class="compare">${x}</p>` : '');
  const typical = (x: string) => `Typical for ${esc(gw)}: ${x} (the middle value, or ${term('typical-peer', 'median')}).`;

  // ---------- card 1: money ----------
  const spendRank = (() => {
    if (!prRank || prRank.of < 2) return '';
    const st = standing(myPr, peerPr)!;
    const words = st.above === 0 && st.below > 0 ? 'the highest' : st.below === 0 && st.above > 0 ? 'the lowest' : standingPhrase(st, 'higher', 'lower').toLowerCase();
    return `${ordinal(prRank.rank)} of ${prRank.of} in the comparison group (${words}).`;
  })();
  const prevPr = prev ? perResident(totals(me, prev).spend, me.pop) : null;
  const card1 = `
    <div class="card tile qcard">
      <h3 class="q">How much national road and flood money came here?</h3>
      <p class="answer">${myPr != null ? `${fmtPeso(myPr)} for every person in ${esc(short)}` : 'Not known: the population isn’t listed'}</p>
      ${cmp(spendComparison(myPr != null && prMed ? myPr / prMed : null, gw))}
      ${prev ? `<p class="context">${spendChange(myPr, prevPr, sinceWords(prev, per))}</p>` : ''}
      ${details(`
        <p><b>${term('dpwh', 'DPWH')} money per person, ${esc(periodName)}:</b> ${fmtPeso(myPr)}.</p>
        <p>${fmtPesoCompact(myT.spend)} total DPWH project cost ÷ ${me.pop?.toLocaleString('en-PH') ?? '—'} people (2024 population).</p>
        ${spendRank ? `<p>${spendRank} ${prMed != null ? typical(fmtPeso(prMed)) : ''}</p>` : ''}
        ${prev && prevPr != null ? `<p>${esc(prev.label)}: ${fmtPeso(prevPr)} per person.</p>` : ''}
        <p>${groupNote}</p>
        <p>Projects are counted by ${term('budget-year', 'budget year')}: the year the money was approved.</p>`)}
    </div>`;

  // ---------- card 2: poverty ----------
  const trend = povertyTrend(me.pov, me.povPrev, me.povPrevYear);
  const povStanding = standingPhrase(standing(me.pov, peerPov), 'higher', 'lower');
  const card2 = `
    <div class="card tile qcard">
      <h3 class="q">How poor is this place?</h3>
      <p class="answer">${povertyAnswer(me.pov)}</p>
      ${cmp(povertyComparison(me.pov, povMed, gw))}
      ${trend ? `<div class="status ${trend.status}">${ICON[trend.status]}${trend.text}</div>` : ''}
      ${me.povLevel === 'prov' ? `<div class="warn-chip wrap">${ICON.warn}<span>Figure for the whole province of ${esc(me.prov)}.</span></div>` : ''}
      ${me.pov != null ? details(`
        <p><b>${term('poverty', 'Poverty incidence')}:</b> ${me.pov.toFixed(1)}% (${me.povYear})${me.povPrev != null ? `, was ${me.povPrev.toFixed(1)}% in ${me.povPrevYear}` : ''}.</p>
        <p>The Philippine Statistics Authority (PSA) counts a person as poor when their family earns less than the poverty line: the minimum needed for food and other basic needs.
        ${line ? `For ${esc(line.area)} in ${line.year} that line was about <b>${fmtPeso(line.monthly)} a month for a family of five</b> (<a href="${esc(line.source)}" rel="noopener">PSA Full Year Poverty Statistics, Table 2a</a>; PSA’s yearly figure per person × 5 ÷ 12).` : ''}</p>
        ${povMed != null && others > 0 ? `<p>${typical(`${povMed.toFixed(1)}%`)}${povStanding ? ` ${povStanding}.` : ''}</p>` : ''}
        ${me.povLevel === 'prov' ? `<p>The poverty figures loaded so far are for provinces and large cities, so ${esc(short)} is shown with the figure for all of ${esc(me.prov)}.</p>` : ''}`) : ''}
    </div>`;

  // ---------- card 3: companies ----------
  const card3 = `
    <div class="card tile qcard">
      <h3 class="q">Did a few companies get most of the money?</h3>
      <p class="answer">${top3Answer(myTop3)}</p>
      ${companiesLine(nCompanies) ? `<p class="context">${companiesLine(nCompanies)}</p>` : ''}
      ${cmp(isPreset ? top3Comparison(myTop3, top3Med, gw) : '')}
      ${details(`
        <p><b>Top-3 contractor share:</b> ${fmtPct(myTop3, 1)} of the money went to the 3 contractors with the most.</p>
        ${isPreset && others > 0 ? `<p>${standingPhrase(standing(myTop3, peerTop3), 'more concentrated', 'less concentrated')}. ${top3Med != null ? typical(fmtPct(top3Med)) : ''}</p>` : '<p>The comparison with similar places is shown for the preset periods only.</p>'}
        <p>${term('joint-venture', 'Joint-venture')} contracts are split equally between the partners.</p>`)}
    </div>`;

  // ---------- card 4: finished ----------
  const newest = per.to;
  const isOpen = (p: LguProject) => p[3] === 'ongoing' || p[3] === 'procurement' || p[3] === 'notstarted';
  const ongoingNew = periodProjects.filter((p) => p[5] === newest && p[3] === 'ongoing').length;
  const notStarted = periodProjects.filter((p) => p[3] === 'procurement' || p[3] === 'notstarted').length;
  const unfinished = periodProjects.filter(isOpen).length;
  const newUnfinished = periodProjects.filter((p) => p[5] === newest && isOpen(p)).length;
  const unfinishedText = myT.known > myT.completed ? unfinishedLine({ year: newest, ongoing: ongoingNew, notStarted }) : '';
  const card4 = `
    <div class="card tile qcard">
      <h3 class="q">How much of it is actually finished?</h3>
      <p class="answer">${completionAnswer(myT.completed, myT.known)}</p>
      ${unfinishedText ? `<p class="context">${unfinishedText}</p>` : ''}
      ${cmp(completionComparison(myComp, compMed, gw, { name: short, unfinished, newUnfinished }))}
      ${details(`
        <p><b>Completion rate:</b> ${fmtPct(myComp)} = ${myT.completed} finished ÷ ${myT.known} projects with a known status.</p>
        ${others > 0 ? `<p>${standingPhrase(standing(myComp, peerComp), 'higher', 'lower')}. ${compMed != null ? typical(fmtPct(compMed)) : ''}</p>` : ''}
        <p>Projects are listed under the ${term('budget-year', 'budget year')} their money was approved; building usually takes one to two more years, so recent years look unfinished.</p>`)}
    </div>`;
  keepOpen($('#tiles'), card1 + card2 + card3 + card4);

  $('#period-note').innerHTML = [per.note, me.reg === SEPARATE_REGION ? SEPARATE_NOTE : null]
    .filter(Boolean).map((n) => `<div class="banner">${esc(n)}</div>`).join('');

  // ---------- category bars ----------
  const catMed: Record<Category, number | null> = { flood: null, roads: null, buildings: null, other: null };
  for (const c of CATEGORIES) catMed[c] = median(group.map((l) => perResident(T(l).byCategory[c], l.pop)).filter((x): x is number => x != null));
  const myCat = Object.fromEntries(CATEGORIES.map((c) => [c, perResident(myT.byCategory[c], me.pop) ?? 0])) as Record<Category, number>;
  const catMax = Math.max(1, ...CATEGORIES.map((c) => Math.max(myCat[c], catMed[c] ?? 0)));
  keepOpen($('#categories'), `
    <div class="bars">
      ${CATEGORIES.map((c) => `
        <div class="cat-row">
          <div class="cat-top"><span class="cat-name">${CATEGORY_LABEL[c]}</span><span class="num">${fmtPesoCompact(myT.byCategory[c])} total, ${fmtPeso(myCat[c])} per person</span></div>
          <span class="bar-track" title="Typical for ${esc(gw)}: ${fmtPeso(catMed[c])} per person">
            <span class="bar-fill" style="display:block;width:${(100 * myCat[c]) / catMax}%"></span>
            ${catMed[c] != null ? `<span class="bar-tick" style="left:${(100 * catMed[c]!) / catMax}%"></span>` : ''}
          </span>
          ${others > 0 ? `<div class="cat-cmp">${categoryComparison(myCat[c], catMed[c], gw)}</div>` : ''}
        </div>`).join('')}
    </div>
    <p class="faint small" style="margin-top:10px">Bar = money per person in ${esc(short)}. Tick = typical for ${esc(gw)}.</p>
    <details class="table-view"><summary>Table view</summary><div class="table-wrap"><table>
      <thead><tr><th>Type of work</th><th class="r">Total</th><th class="r">Per person</th><th class="r">Typical per person</th></tr></thead>
      <tbody>${CATEGORIES.map((c) => `<tr><td>${CATEGORY_LABEL[c]}</td><td class="r num">${fmtPeso(myT.byCategory[c])}</td><td class="r num">${fmtPeso(myCat[c])}</td><td class="r num">${fmtPeso(catMed[c])}</td></tr>`).join('')}</tbody>
    </table></div></details>`);

  // ---------- closest peers ----------
  renderClosestPeers(me, group, per, isPreset, gw, noun);

  // ---------- scatter ----------
  const pts: Point[] = group
    .filter((l) => l.pov != null && l.pop)
    .map((l) => ({
      psgc: l.psgc, name: l.name, prov: l.prov, x: l.pov!, y: pr(l) ?? 0, pop: l.pop!,
      group: l.psgc === me.psgc ? 0 : l.reg === me.reg ? 1 : 2, hl: l.psgc === me.psgc, povLevel: l.povLevel, povYear: l.povYear,
    }));
  const hlWord = getComputedStyle(document.documentElement).getPropertyValue('--hl').trim().toLowerCase() === '#ffffff' ? 'white' : 'black';
  $('#scatter-sub').textContent = `Each dot is one ${noun[0]}. Further right = poorer. Higher up = more money per person. ${short} is the ${hlWord} dot. Tap or click a dot to open that place.`;
  const labels: [string, string, string] = [short, `Same region as ${short}`, state.peer === 'class' ? `Other ${gw}` : 'Other places'];
  $('#scatter-legend').innerHTML = legendHtml(labels, [true, pts.some((p) => p.group === 1), pts.some((p) => p.group === 2)], ['--hl', '--c1', '--c2']);
  const { over, cap } = renderScatter($('#scatter'), pts, {
    groupLabels: labels,
    colors: ['--hl', '--c1', '--c2'],
    log: false,
    xLabel: 'Poorer →',
    yLabel: '↑ More money per person',
    onPick: (p) => { location.href = `/lgu/${p.psgc}/${location.search}`; },
  });
  const provLevel = pts.filter((p) => p.povLevel === 'prov').length;
  $('#scatter-warn').innerHTML = provLevel ? provWarning(provLevel, pts.length, noun[1]) : '';
  $('#scatter-note').textContent = `Dashed lines show the middle of the group: half the ${noun[1]} are on each side. "Poorer", "better-off", "more" and "less money" are compared with those lines. Bigger dot = more people.` +
    (over ? ` ▲ ${over} ${over > 1 ? noun[1] : noun[0]} above ${fmtPeso(cap)} per person ${over > 1 ? 'are' : 'is'} drawn at the top edge.` : '');
  $('#scatter-table').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Province</th><th class="r">How many are poor</th><th class="r">Money per person</th><th class="r">People</th></tr></thead><tbody>${
    [...pts].sort((a, b) => b.y - a.y).map((p) => `<tr class="${p.group === 0 ? 'me' : ''}"><td><a href="/lgu/${p.psgc}/">${esc(p.name)}</a></td><td>${esc(p.prov)}</td><td class="r num">${povertyCell(p.x)}</td><td class="r num">${fmtPeso(p.y)}</td><td class="r num">${p.pop.toLocaleString('en-PH')}</td></tr>`).join('')
  }</tbody></table></div>`;

  // ---------- contractors ----------
  const periodTotal = periodProjects.reduce((s, p) => s + p[4], 0);
  const cons = contractorTable(periodProjects);
  $('#contractors-intro').textContent = `The companies hired to build the projects. "Share" is their slice of all the national money spent in ${short} in this period.`;
  $('#contractors').innerHTML = cons.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Company</th><th class="r">Projects</th><th class="r">Amount</th><th class="r">Share</th></tr></thead>
        <tbody>${cons.slice(0, 15).map((c, i) => `<tr><td class="faint">${i + 1}</td><td>${contractorLink(file, c.id)}</td><td class="r num">${c.n}</td><td class="r num">${fmtPesoCompact(c.spend)}</td><td class="r num">${fmtPct(c.spend / periodTotal, 1)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="faint small" style="margin-top:8px">${cons.length.toLocaleString('en-PH')} ${cons.length === 1 ? 'company' : 'companies'} in total. When companies share one contract, we split it equally between them.${periodProjects.some((p) => !p[6].length) ? ' Contracts with no company listed yet (usually still being bid out) count in the total but not in any company’s share.' : ''}</p>`
    : `<p class="muted">No company data for this period.</p>`;

  renderProjects(me, file, periodProjects);

  // ---------- how sure are we (collapsed) ----------
  const cov = index.regionCoverage[me.reg];
  const byConf = (c: string) => periodProjects.filter((p) => p[7] === c).length;
  const [high, medium, low] = [byConf('high'), byConf('medium'), byConf('low')];
  const renderCoverage = () => {
    $('#coverage').innerHTML = `
      <p>DPWH doesn’t say which town a project is in. We worked it out from the project’s name and its map location. <b>${high.toLocaleString('en-PH')} of ${periodProjects.length.toLocaleString('en-PH')} projects</b> here are a confident match.</p>
      ${medium || low ? `<p>${medium ? `${medium.toLocaleString('en-PH')} ${medium === 1 ? 'is a likely match' : 'are likely matches'} (only one of the two clues, or the two disagree and we followed the name)` : ''}${medium && low ? '; ' : ''}${low ? `${low.toLocaleString('en-PH')} ${low === 1 ? 'is a rough match' : 'are rough matches'} (we only know the ${term('deo', 'local DPWH office')} for ${esc(short)} handled it)` : ''}.</p>` : ''}
      ${cov ? `<p>Across ${esc(me.reg)}, ${fmtPct(cov.mapped / cov.n)} of national projects (${fmtPct(cov.mappedValue / cov.value)} of the money) could be placed in a city or town. The rest (${(cov.n - cov.mapped).toLocaleString()} projects, ${fmtPesoCompact(cov.value - cov.mappedValue)}) aren’t counted for any place.</p>` : ''}
      <p>A project that runs through several towns, such as a stretch of highway, is counted in one town only.</p>
      <p><button class="btn" data-conf>${showConfidence ? 'Hide' : 'Show'} how sure we are about each project</button></p>
      <p class="faint small">More: ${term('confidence', 'how we place projects')}, the <a href="/data/psgc-map.csv">mapping table</a> (CC0), and the full <a href="/about/#mapping">method</a>.</p>`;
    linkFirstTerms();
  };
  renderCoverage();
  $('#coverage').onclick = (ev) => {
    if (!(ev.target as HTMLElement).closest('[data-conf]')) return;
    showConfidence = !showConfidence;
    renderProjects(me, file, periodProjects);
    renderCoverage();
  };

  $('#sources').innerHTML = (Object.keys(SOURCE_LABEL) as (keyof typeof SOURCE_LABEL)[])
    .map((k) => `<li><a href="${esc(index.sources[k].url)}" rel="noopener">${SOURCE_LABEL[k]}</a>, retrieved ${esc(index.sources[k].fetched)}</li>`).join('') +
    (line ? `<li><a href="${esc(line.source)}" rel="noopener">PSA poverty lines by province and large city (Full Year Poverty Statistics, Table 2a)</a></li>` : '');
  linkFirstTerms();
}

function renderClosestPeers(me: IndexRow, group: IndexRow[], per: PeriodDef, isPreset: boolean, gw: string, noun: string[]) {
  const pr = (l: IndexRow) => perResident(totals(l, per).spend, l.pop);
  const closest = group
    .filter((l) => l.psgc !== me.psgc && l.pop)
    .sort((a, b) => Math.abs(Math.log(a.pop! / me.pop!)) - Math.abs(Math.log(b.pop! / me.pop!)))
    .slice(0, 6);
  const rows = [me, ...closest];
  const cols: { label: string; get: (l: IndexRow) => number | null; fmt: (x: number | null) => string }[] = [
    { label: 'Money per person', get: pr, fmt: (x) => fmtPeso(x) },
    { label: 'How many are poor', get: (l) => l.pov, fmt: povertyCell },
    ...(isPreset ? [{ label: 'Share won by top 3 companies', get: (l: IndexRow) => (per.id in l.top3 ? l.top3[per.id] : null), fmt: (x: number | null) => fmtPct(x) }] : []),
  ];
  const stats = cols.map((c) => {
    const v = group.map(c.get).filter((x): x is number => x != null);
    return { min: Math.min(...v), max: Math.max(...v), med: median(v) };
  });
  const dot = (x: number | null, s: { min: number; max: number; med: number | null }, isMe: boolean) => {
    if (x == null || !Number.isFinite(s.min)) return '<span class="range"></span>';
    const f = (v: number) => (s.max > s.min ? (100 * (v - s.min)) / (s.max - s.min) : 50);
    return `<span class="range" aria-hidden="true"><span class="range-track"></span>${s.med != null ? `<span class="range-med" style="left:${f(s.med)}%"></span>` : ''}<span class="range-dot${isMe ? ' me' : ''}" style="left:${f(x)}%"></span></span>`;
  };
  $('#closest-title').textContent = `${gw[0].toUpperCase()}${gw.slice(1)} side by side`;
  $('#closest').innerHTML = `<div class="table-wrap"><table class="peers-table">
    <thead><tr><th>${noun[0][0].toUpperCase()}${noun[0].slice(1)}</th>${cols.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((l) => `<tr class="${l.psgc === me.psgc ? 'me' : ''}">
      <td>${l.psgc === me.psgc ? esc(l.name) : `<a href="/lgu/${l.psgc}/${location.search}">${esc(l.name)}</a>`}<div class="faint small">${esc(l.prov)}</div></td>
      ${cols.map((c, i) => `<td><div class="range-cell">${dot(c.get(l), stats[i], l.psgc === me.psgc)}<span class="num">${c.fmt(c.get(l))}</span></div></td>`).join('')}
    </tr>`).join('')}</tbody></table></div>
    <p class="faint small" style="margin-top:8px">The ${closest.length} ${esc(gw)} closest in population to ${esc(shortName(me.name))}. The grey bar shows the range across all ${group.length}; the tick is the typical value.</p>`;
}

/** Plain reason behind each project's confidence label (see /glossary/#confidence). */
function placedWhy(method: string | null, conf: string | null) {
  switch (method) {
    case 'text+geo': return 'High: the place named in the description and the map point agree';
    case 'text': return conf === 'high' ? 'High: the description names the town and province' : 'Medium: the description names the town, but there is no usable map point';
    case 'geo': return 'Medium: only the map point; the description names no town';
    case 'text-geo-conflict': return 'Medium: the description and the map point disagree; we followed the description';
    case 'deo': return 'Low: we only know it was handled by the city’s own DPWH office';
    default: return conf ?? '';
  }
}

/** Plain names for the sources (the data files carry the technical ones). */
const SOURCE_LABEL = {
  dpwh: 'DPWH Transparency Portal project list, via BetterGov.PH',
  psgc: 'PSA list of cities and towns with their 2024 population, via BetterGov.PH',
  poverty: 'PSA poverty figures for provinces and large cities (2018, 2021 and 2023), via BetterGov.PH',
} as const;

type SortKey = 'year' | 'budget' | 'desc' | 'status';
let sortKey: SortKey = 'year';
let sortDir = -1;
let showAll = false;
let catFilter: Category | 'all' = 'all';
let showConfidence = false;

function renderProjects(me: IndexRow, file: LguFile, projects: LguProject[]) {
  const el = $('#projects');
  const filtered = projects.filter((p) => catFilter === 'all' || p[2] === catFilter);
  const key: Record<SortKey, (p: LguProject) => string | number> = {
    year: (p) => (p[5] ?? 0) * 1e13 + p[4], budget: (p) => p[4], desc: (p) => p[1], status: (p) => p[3],
  };
  const sorted = [...filtered].sort((a, b) => (key[sortKey](a) > key[sortKey](b) ? 1 : key[sortKey](a) < key[sortKey](b) ? -1 : 0) * sortDir);
  const shown = showAll ? sorted : sorted.slice(0, 50);
  const th = (k: SortKey, label: string, cls = '') =>
    `<th class="${cls}" aria-sort="${sortKey === k ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'}"><button data-sort="${k}">${label}${sortKey === k ? (sortDir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
  el.innerHTML = `
    <div class="control-group" style="margin-bottom:10px">
      <span class="control-label">Show</span>
      <button class="chip" data-cat="all" aria-pressed="${catFilter === 'all'}">All (${projects.length})</button>
      ${CATEGORIES.map((c) => `<button class="chip" data-cat="${c}" aria-pressed="${catFilter === c}">${CATEGORY_LABEL[c]} (${projects.filter((p) => p[2] === c).length})</button>`).join('')}
    </div>
    <div class="table-wrap"><table>
      <thead><tr>${th('year', 'Year')}${th('desc', 'Project')}${th('status', 'Status')}${th('budget', 'Cost', 'r')}<th>Company</th>${showConfidence ? `<th title="How sure we are that this project is in this ${me.kind === 'City' ? 'city' : 'town'}">How sure</th>` : ''}</tr></thead>
      <tbody>${shown.map((p) => `<tr>
        <td class="num">${p[5] ?? '—'}</td>
        <td class="desc">${esc(p[1])}<div class="faint small">${esc(p[0])} · ${CATEGORY_LABEL[p[2]]}</div></td>
        <td><span class="pill">${STATUS_LABEL[p[3]]}</span></td>
        <td class="r num">${p[4] ? fmtPesoCompact(p[4]) : '—'}</td>
        <td>${p[6].map((id) => contractorLink(file, id)).join('<br>') || '<span class="faint">—</span>'}</td>
        ${showConfidence ? `<td><span class="pill" title="${esc(placedWhy(p[8], p[7]))}">${esc(p[7] ?? '')}</span><div class="faint small">${esc(placedWhy(p[8], p[7]).replace(/^\w+: /, ''))}</div></td>` : ''}
      </tr>`).join('')}</tbody>
    </table></div>
    ${sorted.length > shown.length ? `<p style="margin-top:10px"><button class="btn" data-more>Show all ${sorted.length} projects</button></p>` : ''}`;
  linkFirstTerms();
  el.onclick = (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.sort) {
      const k = b.dataset.sort as SortKey;
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'desc' || k === 'status' ? 1 : -1; }
    } else if (b.dataset.cat) catFilter = b.dataset.cat as Category | 'all';
    else if ('more' in b.dataset) showAll = true;
    renderProjects(me, file, projects);
  };
}
