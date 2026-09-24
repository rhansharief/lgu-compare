import {
  CATEGORIES, CATEGORY_LABEL, SEPARATE_NOTE, SEPARATE_REGION, completionRate, fmtPct, fmtPeso, fmtPesoCompact, median, ordinal, peerLabel, peers,
  perResident, prevOf, rankDesc, totals, type Category, type PeriodDef,
} from '../metrics.ts';
import { renderControls } from './controls.ts';
import { esc, loadIndex, loadLgu, STATUS_LABEL, type IndexFile, type IndexRow, type LguFile, type LguProject } from './data.ts';
import { legendHtml, renderScatter, type Point } from './scatter.ts';
import { periodOf, readState, writeState, type ViewState } from './state.ts';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

export async function initLguPage(psgc: string) {
  const state = readState({ peer: 'class', period: 'last3' });
  const [index, lguFile] = await Promise.all([loadIndex(), loadLgu(psgc)]);
  const me = index.lgus.find((l) => l.psgc === psgc)!;
  const update = () => {
    writeState(state, ['peer', 'period', 'from', 'to']);
    render(index, me, lguFile, state);
  };
  renderControls($('#controls'), state, {}, update);
  update();
  let w = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - w) > 40) { w = window.innerWidth; update(); } });
  window.addEventListener('themechange', update);
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

function inPeriod(p: LguProject, per: Pick<PeriodDef, 'from' | 'to'>) {
  return p[5] != null && p[5] >= per.from && p[5] <= per.to;
}

function top3For(l: IndexRow, per: PeriodDef): number | null {
  return per.id in l.top3 ? l.top3[per.id] : null;
}

function render(index: IndexFile, me: IndexRow, file: LguFile, state: ViewState) {
  const per = periodOf(state);
  const prev = prevOf(per);
  const group = peers(me, index.lgus, state.peer);
  const others = group.length - 1;
  $('#peer-count').textContent = `vs. ${others} ${state.peer === 'country' ? 'other' : 'similar'} LGU${others === 1 ? '' : 's'}`;
  $('#peer-label').textContent = `Peer group: ${peerLabel(state.peer, me, index.lgus)} (${group.length} LGUs)`;

  const T = (l: IndexRow) => totals(l, per);
  const myT = T(me);
  const pr = (l: IndexRow) => perResident(T(l).spend, l.pop);
  const myPr = pr(me);
  const peerPr = group.map(pr);
  const prRank = rankDesc(myPr, peerPr);
  const prMed = median(peerPr.filter((x): x is number => x != null));

  const periodProjects = file.projects.filter((p) => inPeriod(p, per));
  const isPreset = per.id in me.top3;
  const myTop3 = isPreset ? top3For(me, per) : (() => {
    const total = periodProjects.reduce((s, p) => s + p[4], 0);
    if (!total) return null;
    return contractorTable(periodProjects).slice(0, 3).reduce((s, c) => s + c.spend, 0) / total;
  })();
  const peerTop3 = isPreset ? group.map((l) => top3For(l, per)) : [];
  const top3Rank = isPreset ? rankDesc(myTop3, peerTop3) : null;
  const top3Med = isPreset ? median(peerTop3.filter((x): x is number => x != null)) : null;

  const myComp = completionRate(myT);
  const peerComp = group.map((l) => completionRate(T(l)));
  const compMed = median(peerComp.filter((x): x is number => x != null));

  const peerPov = group.map((l) => l.pov).filter((x): x is number => x != null);
  const povMed = median(peerPov);

  // ---------- tiles ----------
  const rankTxt = (r: { rank: number; of: number } | null) => (r ? `<b>${ordinal(r.rank)}</b> of ${r.of}` : '');
  let delta = '';
  if (prev) {
    const prevPr = perResident(totals(me, prev).spend, me.pop);
    if (prevPr != null && myPr != null) {
      const d = myPr - prevPr;
      delta = `<div class="context">${d >= 0 ? '▲' : '▼'} ${fmtPeso(Math.abs(d))} vs ${esc(prev.label)}</div>`;
    }
  }
  const povNote = me.povLevel === 'prov'
    ? `<div class="note">Figure for all of ${esc(me.prov)}. PSA's city/municipal estimates aren't loaded yet.</div>`
    : '';
  const povChange = me.pov != null && me.povPrev != null
    ? `${me.pov - me.povPrev <= 0 ? '▼' : '▲'} ${Math.abs(me.pov - me.povPrev).toFixed(1)} pts since ${me.povPrevYear} · `
    : '';
  $('#tiles').innerHTML = `
    <div class="card tile">
      <div class="label">DPWH infra spend per resident, ${esc(per.label)}</div>
      <div class="value num">${fmtPeso(myPr)}</div>
      <div class="context">${rankTxt(prRank)}${prMed != null ? ` · peer median ${fmtPeso(prMed)}` : ''}</div>
      ${delta}
      <div class="note">${fmtPesoCompact(myT.spend)} total ÷ ${me.pop?.toLocaleString('en-PH') ?? '—'} residents (2024)</div>
    </div>
    <div class="card tile">
      <div class="label">Poverty incidence${me.povYear ? ` (${me.povYear})` : ''}</div>
      <div class="value num">${me.pov != null ? `${me.pov.toFixed(1)}%` : '—'}</div>
      <div class="context">${povChange}${povMed != null ? `peer median ${povMed.toFixed(1)}%` : ''}</div>
      ${povNote}
    </div>
    <div class="card tile">
      <div class="label">Top-3 contractor share</div>
      <div class="value num">${fmtPct(myTop3)}</div>
      <div class="context">${top3Rank ? `${rankTxt(top3Rank)} (1st = most concentrated)` : 'Peer ranks shown for preset periods only'}${top3Med != null ? ` · peer median ${fmtPct(top3Med)}` : ''}</div>
      <div class="note">Share of this LGU's DPWH spend won by its 3 biggest contractors</div>
    </div>
    <div class="card tile">
      <div class="label">Project completion rate</div>
      <div class="value num">${fmtPct(myComp)}</div>
      <div class="context">${myT.completed} of ${myT.known} projects${compMed != null ? ` · peer median ${fmtPct(compMed)}` : ''}</div>
      <div class="note">Completed ÷ projects with a known status (includes ones still being procured)</div>
    </div>`;

  $('#period-note').innerHTML = [per.note, me.reg === SEPARATE_REGION ? SEPARATE_NOTE : null]
    .filter(Boolean).map((n) => `<div class="banner">${esc(n)}</div>`).join('');

  // ---------- category bars ----------
  const catMed: Record<Category, number | null> = { flood: null, roads: null, buildings: null, other: null };
  for (const c of CATEGORIES) catMed[c] = median(group.map((l) => perResident(T(l).byCategory[c], l.pop)).filter((x): x is number => x != null));
  const myCat = Object.fromEntries(CATEGORIES.map((c) => [c, perResident(myT.byCategory[c], me.pop) ?? 0])) as Record<Category, number>;
  const catMax = Math.max(1, ...CATEGORIES.map((c) => Math.max(myCat[c], catMed[c] ?? 0)));
  $('#categories').innerHTML = `
    <div class="bars">
      ${CATEGORIES.map((c) => `
        <div class="bar-row">
          <span>${CATEGORY_LABEL[c]}</span>
          <span class="bar-track" title="Peer median ${fmtPeso(catMed[c])}">
            <span class="bar-fill" style="display:block;width:${(100 * myCat[c]) / catMax}%"></span>
            ${catMed[c] != null ? `<span class="bar-tick" style="left:${(100 * catMed[c]!) / catMax}%"></span>` : ''}
          </span>
          <span class="v num">${fmtPeso(myCat[c])} <span class="faint">· ${fmtPesoCompact(myT.byCategory[c])}</span></span>
        </div>`).join('')}
    </div>
    <p class="faint small" style="margin-top:10px">Bar = per resident in ${esc(me.name)}. Tick = peer median per resident.</p>
    <details class="table-view"><summary>Table view</summary><div class="table-wrap"><table>
      <thead><tr><th>Category</th><th class="r">Total</th><th class="r">Per resident</th><th class="r">Peer median / resident</th></tr></thead>
      <tbody>${CATEGORIES.map((c) => `<tr><td>${CATEGORY_LABEL[c]}</td><td class="r num">${fmtPeso(myT.byCategory[c])}</td><td class="r num">${fmtPeso(myCat[c])}</td><td class="r num">${fmtPeso(catMed[c])}</td></tr>`).join('')}</tbody>
    </table></div></details>`;

  // ---------- closest peers ----------
  renderClosestPeers(me, group, per, isPreset);

  // ---------- scatter ----------
  const pts: Point[] = group
    .filter((l) => l.pov != null && l.pop)
    .map((l) => ({
      psgc: l.psgc, name: l.name, prov: l.prov, x: l.pov!, y: pr(l) ?? 0, pop: l.pop!,
      group: l.psgc === me.psgc ? 0 : l.reg === me.reg ? 1 : 2, hl: l.psgc === me.psgc, povLevel: l.povLevel, povYear: l.povYear,
    }));
  const labels: [string, string, string] = [me.name, `${me.reg}`, `Other peers`];
  $('#scatter-legend').innerHTML = legendHtml(labels, [true, pts.some((p) => p.group === 1), pts.some((p) => p.group === 2)], ['--hl', '--c1', '--c2']);
  const { over, cap } = renderScatter($('#scatter'), pts, {
    groupLabels: labels,
    colors: ['--hl', '--c1', '--c2'],
    log: false,
    yLabel: `↑ DPWH spend per resident, ${per.label}`,
    onPick: (p) => { location.href = `/lgu/${p.psgc}/${location.search}`; },
  });
  const provLevel = pts.filter((p) => p.povLevel === 'prov').length;
  $('#scatter-note').textContent = `${pts.length} LGUs in this peer group (${peerLabel(state.peer, me, index.lgus)}). ` +
    (provLevel ? `${provLevel} of them use a province-wide poverty figure, so dots from the same province line up vertically. ` : '') +
    'Dashed lines = peer medians. Dot size = population.' +
    (over ? ` ▲ ${over} LGU${over > 1 ? 's' : ''} above ${fmtPeso(cap)} per resident drawn at the top edge.` : '');
  $('#scatter-table').innerHTML = `<div class="table-wrap"><table><thead><tr><th>LGU</th><th>Province</th><th class="r">Poverty %</th><th class="r">Spend / resident</th><th class="r">Population</th></tr></thead><tbody>${
    [...pts].sort((a, b) => b.y - a.y).map((p) => `<tr class="${p.group === 0 ? 'me' : ''}"><td><a href="/lgu/${p.psgc}/">${esc(p.name)}</a></td><td>${esc(p.prov)}</td><td class="r num">${p.x.toFixed(1)}</td><td class="r num">${fmtPeso(p.y)}</td><td class="r num">${p.pop.toLocaleString('en-PH')}</td></tr>`).join('')
  }</tbody></table></div>`;

  // ---------- contractors ----------
  const periodTotal = periodProjects.reduce((s, p) => s + p[4], 0);
  const cons = contractorTable(periodProjects);
  $('#contractors').innerHTML = cons.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Contractor</th><th class="r">Projects</th><th class="r">Amount</th><th class="r">Share</th></tr></thead>
        <tbody>${cons.slice(0, 15).map((c, i) => `<tr><td class="faint">${i + 1}</td><td><a href="/contractor/${esc(c.id)}/">${esc(file.contractors[c.id] ?? c.id)}</a></td><td class="r num">${c.n}</td><td class="r num">${fmtPesoCompact(c.spend)}</td><td class="r num">${fmtPct(c.spend / periodTotal, 1)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="faint small" style="margin-top:8px">${cons.length} contractors in total. Joint-venture contracts are split equally between partners.${periodProjects.some((p) => !p[6].length) ? ' Contracts without a listed contractor (usually still in procurement) count in the total but not in any contractor\'s share.' : ''}</p>`
    : `<p class="muted">No contractor data for this period.</p>`;

  renderProjects(file, periodProjects);

  // ---------- coverage ----------
  const cov = index.regionCoverage[me.reg];
  const c = me.conf;
  const mapped = c.high + c.medium + c.low;
  $('#coverage').innerHTML = `
    <p><b>How sure are we these projects are in ${esc(me.name)}?</b> DPWH lists projects by district engineering office, not by town. We placed each project using the town named in its description and its map coordinates.</p>
    <ul>
      <li>${esc(me.name)}: ${mapped.toLocaleString()} projects placed here across all years. <b>${c.high.toLocaleString()}</b> high confidence (town and province named, or text and coordinates agree), <b>${c.medium.toLocaleString()}</b> medium (one signal only, or the two disagree and we followed the text), <b>${c.low.toLocaleString()}</b> low (only the city's own engineering office).</li>
      ${cov ? `<li>${esc(me.reg)}: ${fmtPct(cov.mapped / cov.n, 1)} of DPWH projects (${fmtPct(cov.mappedValue / cov.value, 1)} of their value) could be placed in a city or municipality. The rest (${(cov.n - cov.mapped).toLocaleString()} projects, ${fmtPesoCompact(cov.value - cov.mappedValue)}) are not counted for any LGU.</li>` : ''}
      <li>A project that spans several towns (e.g. a highway section) is counted in one town only.</li>
    </ul>
    <p class="faint small">Mapping table: <a href="/data/psgc-map.csv">psgc-map.csv</a> (CC0). Method: <a href="/about/#mapping">how projects are placed</a>.</p>`;

  $('#sources').innerHTML = Object.values(index.sources).map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a>, retrieved ${esc(s.fetched)}</li>`).join('');
}

function renderClosestPeers(me: IndexRow, group: IndexRow[], per: PeriodDef, isPreset: boolean) {
  const pr = (l: IndexRow) => perResident(totals(l, per).spend, l.pop);
  const closest = group
    .filter((l) => l.psgc !== me.psgc && l.pop)
    .sort((a, b) => Math.abs(Math.log(a.pop! / me.pop!)) - Math.abs(Math.log(b.pop! / me.pop!)))
    .slice(0, 6);
  const rows = [me, ...closest];
  const cols: { label: string; get: (l: IndexRow) => number | null; fmt: (x: number | null) => string }[] = [
    { label: 'Spend / resident', get: pr, fmt: (x) => fmtPeso(x) },
    { label: 'Poverty', get: (l) => l.pov, fmt: (x) => (x == null ? '—' : `${x.toFixed(1)}%`) },
    ...(isPreset ? [{ label: 'Top-3 share', get: (l: IndexRow) => (per.id in l.top3 ? l.top3[per.id] : null), fmt: (x: number | null) => fmtPct(x) }] : []),
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
  $('#closest').innerHTML = `<div class="table-wrap"><table class="peers-table">
    <thead><tr><th>LGU</th>${cols.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((l) => `<tr class="${l.psgc === me.psgc ? 'me' : ''}">
      <td>${l.psgc === me.psgc ? esc(l.name) : `<a href="/lgu/${l.psgc}/${location.search}">${esc(l.name)}</a>`}<div class="faint small">${esc(l.prov)}</div></td>
      ${cols.map((c, i) => `<td><div class="range-cell">${dot(c.get(l), stats[i], l.psgc === me.psgc)}<span class="num">${c.fmt(c.get(l))}</span></div></td>`).join('')}
    </tr>`).join('')}</tbody></table></div>
    <p class="faint small" style="margin-top:8px">The 6 LGUs in this peer group closest in population. Dot = the LGU. Bar = range across all ${group.length} peers. Tick = peer median. Ranks are per metric; there is no overall score.</p>`;
}

type SortKey = 'year' | 'budget' | 'desc' | 'status';
let sortKey: SortKey = 'year';
let sortDir = -1;
let showAll = false;
let catFilter: Category | 'all' = 'all';

function renderProjects(file: LguFile, projects: LguProject[]) {
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
      <thead><tr>${th('year', 'Year')}${th('desc', 'Project')}${th('status', 'Status')}${th('budget', 'Cost', 'r')}<th>Contractor</th><th>Placed</th></tr></thead>
      <tbody>${shown.map((p) => `<tr>
        <td class="num">${p[5] ?? '—'}</td>
        <td class="desc">${esc(p[1])}<div class="faint small">${esc(p[0])} · ${CATEGORY_LABEL[p[2]]}</div></td>
        <td><span class="pill">${STATUS_LABEL[p[3]]}</span></td>
        <td class="r num">${p[4] ? fmtPesoCompact(p[4]) : '—'}</td>
        <td>${p[6].map((id) => `<a href="/contractor/${esc(id)}/">${esc(file.contractors[id] ?? id)}</a>`).join('<br>') || '<span class="faint">—</span>'}</td>
        <td><span class="pill" title="${esc(p[8])}">${esc(p[7] ?? '')}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${sorted.length > shown.length ? `<p style="margin-top:10px"><button class="btn" data-more>Show all ${sorted.length} projects</button></p>` : ''}`;
  el.onclick = (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.sort) {
      const k = b.dataset.sort as SortKey;
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'desc' || k === 'status' ? 1 : -1; }
    } else if (b.dataset.cat) catFilter = b.dataset.cat as Category | 'all';
    else if ('more' in b.dataset) showAll = true;
    renderProjects(file, projects);
  };
}
