import { CATEGORY_LABEL, SEPARATE_NOTE, comparable, fmtPeso, peerLabel, peers, perResident, spendFor, totals, type IslandGroup } from '../metrics.ts';
import { renderControls } from './controls.ts';
import { esc, loadIndex, type IndexRow } from './data.ts';
import { legendHtml, renderScatter, type Point } from './scatter.ts';
import { initSearch } from './search.ts';
import { periodOf, readState, writeState } from './state.ts';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const ISLANDS: IslandGroup[] = ['Luzon', 'Visayas', 'Mindanao'];

export async function initComparePage() {
  const state = readState({ peer: 'class', period: 'last3', lgu: '1102509000' });
  const index = await loadIndex();
  const byPsgc = new Map(index.lgus.map((l) => [l.psgc, l]));
  if (state.lgu && !byPsgc.has(state.lgu)) state.lgu = null;

  const update = () => {
    writeState(state, ['lgu', 'peer', 'period', 'from', 'to', 'cat', 'log']);
    const me = state.lgu ? byPsgc.get(state.lgu)! : null;
    const input = $<HTMLInputElement>('#compare-search input');
    if (me && document.activeElement !== input) input.value = `${me.name}, ${me.prov}`;
    render(index.lgus, me, state);
  };

  initSearch((e) => { state.lgu = e.psgc; update(); }, $('#compare-search').parentElement!);
  $('#clear-lgu').addEventListener('click', () => { state.lgu = null; if (state.peer !== 'country') state.peer = 'country'; $<HTMLInputElement>('#compare-search input').value = ''; renderControls($('#controls'), state, { category: true }, update); update(); });
  $<HTMLInputElement>('#log').checked = state.log;
  $<HTMLInputElement>('#log').addEventListener('change', (e) => { state.log = (e.target as HTMLInputElement).checked; update(); });
  $('#copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); $('#copy-link').textContent = 'Link copied'; }
    catch { prompt('Copy this link:', location.href); }
    setTimeout(() => { $('#copy-link').textContent = 'Copy link'; }, 1800);
  });
  renderControls($('#controls'), state, { category: true }, update);
  update();
  let w = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - w) > 40) { w = window.innerWidth; update(); } });
  window.addEventListener('themechange', update);
}

function render(all: IndexRow[], me: IndexRow | null, state: ReturnType<typeof readState>) {
  const per = periodOf(state);
  // Without a selected LGU, peer groups other than "whole country" have no anchor.
  const mode = me ? state.peer : 'country';
  const group = me ? peers(me, all, mode) : comparable(null, all);
  const y = (l: IndexRow) => perResident(spendFor(totals(l, per), state.cat), l.pop) ?? 0;

  const pts: Point[] = group
    .filter((l) => l.pov != null && l.pop)
    .map((l) => ({
      psgc: l.psgc, name: l.name, prov: l.prov, x: l.pov!, y: y(l), pop: l.pop!, povLevel: l.povLevel, povYear: l.povYear,
      group: me && l.psgc === me.psgc ? 0 : me ? (l.reg === me.reg ? 1 : 2) : (ISLANDS.indexOf(l.island) as 0 | 1 | 2),
      hl: !!me && l.psgc === me.psgc,
    }));

  // With no highlighted LGU the three groups are the island groups (still max 3 colors).
  const labels: [string, string, string] = me ? [me.name, me.reg, 'Other peers'] : ['Luzon', 'Visayas', 'Mindanao'];
  const colors: [string, string, string] = me ? ['--hl', '--c1', '--c2'] : ['--c1', '--c2', '--c3'];
  $('#legend').innerHTML = legendHtml(labels, [0, 1, 2].map((g) => pts.some((p) => p.group === g)), colors);
  const catLabel = state.cat === 'all' ? 'all categories' : CATEGORY_LABEL[state.cat].toLowerCase();
  $('#chart-title').textContent = me
    ? `${me.name} and ${group.length - 1} peers: ${peerLabel(mode, me, all)}`
    : `All ${group.length} cities and municipalities outside BARMM`;
  $('#chart-sub').textContent = `DPWH spend per resident (${catLabel}), ${per.label}, against poverty incidence.`;
  const { medX, medY, over, cap } = renderScatter($('#chart'), pts, {
    groupLabels: labels,
    colors,
    log: state.log,
    yLabel: `↑ DPWH spend per resident (${catLabel})`,
    onPick: (p) => { location.href = `/lgu/${p.psgc}/?peer=${state.peer}&period=${state.period}${state.period === 'custom' ? `&from=${state.from}&to=${state.to}` : ''}`; },
  });

  const provLevel = pts.filter((p) => p.povLevel === 'prov').length;
  const dropped = group.length - pts.length;
  const zeroLog = state.log ? pts.filter((p) => p.y <= 0).length : 0;
  $('#chart-note').innerHTML = [
    `Dashed lines are the medians of this group: poverty ${medX?.toFixed(1)}%, spend ${fmtPeso(medY)} per resident. They split the chart into the four labelled quadrants.`,
    provLevel ? `${provLevel} of ${pts.length} LGUs use their province's poverty figure (PSA city/municipal estimates aren't loaded yet), so LGUs in the same province line up vertically.` : '',
    dropped ? `${dropped} LGU${dropped > 1 ? 's' : ''} without a poverty figure or population ${dropped > 1 ? 'are' : 'is'} not shown.` : '',
    zeroLog ? `${zeroLog} LGUs with no spend are hidden on the log scale.` : '',
    over ? `▲ ${over} LGU${over > 1 ? 's' : ''} above ${fmtPeso(cap)} per resident ${over > 1 ? 'are' : 'is'} drawn at the top edge (hover for the value, or use the log scale).` : '',
    per.note ?? '',
    SEPARATE_NOTE,
  ].filter(Boolean).map((s) => `<span>${esc(s)}</span>`).join(' ');

  // Quadrant counts: a plain-language summary, no causal claims.
  if (medX != null && medY != null) {
    const q = { hiNeedLess: 0, hiNeedMore: 0, loNeedMore: 0, loNeedLess: 0 };
    for (const p of pts) {
      if (p.x >= medX) p.y >= medY ? q.hiNeedMore++ : q.hiNeedLess++;
      else p.y >= medY ? q.loNeedMore++ : q.loNeedLess++;
    }
    const mine = me ? pts.find((p) => p.group === 0) : null;
    const where = mine ? `${esc(me!.name)} is in <b>${mine.x >= medX ? 'higher need' : 'lower need'} · ${mine.y >= medY ? 'more money' : 'less money'}</b>. ` : '';
    $('#summary').innerHTML = `${where}Of ${pts.length} LGUs: ${q.hiNeedLess} higher need · less money, ${q.hiNeedMore} higher need · more money, ${q.loNeedMore} lower need · more money, ${q.loNeedLess} lower need · less money.`;
  }

  $('#table').innerHTML = `<div class="table-wrap"><table><thead><tr><th>LGU</th><th>Province</th><th class="r">Poverty %</th><th class="r">Spend / resident</th><th class="r">Population</th></tr></thead><tbody>${
    [...pts].sort((a, b) => b.y - a.y).map((p) => `<tr class="${p.group === 0 && me ? 'me' : ''}"><td><a href="/lgu/${p.psgc}/">${esc(p.name)}</a></td><td>${esc(p.prov)}</td><td class="r num">${p.x.toFixed(1)}${p.povLevel === 'prov' ? '<span class="faint">*</span>' : ''}</td><td class="r num">${fmtPeso(p.y)}</td><td class="r num">${p.pop.toLocaleString('en-PH')}</td></tr>`).join('')
  }</tbody></table></div><p class="faint small">* province-wide figure</p>`;

  // Peer chips need an LGU
  document.querySelectorAll<HTMLButtonElement>('#controls [data-peer]').forEach((b) => { b.disabled = !me && b.dataset.peer !== 'country'; b.title = b.disabled ? 'Pick an LGU first' : ''; });
}
