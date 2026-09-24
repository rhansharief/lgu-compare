import { CATEGORIES, CATEGORY_LABEL, fmtPct, fmtPesoCompact } from '../metrics.ts';
import { esc, loadContractor, STATUS_LABEL, type ContractorFile } from './data.ts';
import { term } from '../terms.ts';
import { linkFirstTerms } from './terms.ts';
import { titleCase } from '../names.ts';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

export async function initContractorPage() {
  const fromPath = location.pathname.match(/^\/contractor\/([^/]+)\/?$/)?.[1];
  const id = decodeURIComponent(fromPath ?? new URLSearchParams(location.search).get('id') ?? '');
  if (!id) { $('#c-name').textContent = 'No contractor selected'; return; }
  const c = await loadContractor(id);
  if (!c) { $('#c-name').textContent = 'Contractor not found'; $('#c-body').innerHTML = `<p class="muted">No DPWH projects for contractor id ${esc(id)}.</p>`; return; }
  render(c);
}

function render(c: ContractorFile) {
  document.title = `${titleCase(c.name)} · Infra Money Tracker`;
  $('#c-name').textContent = titleCase(c.name);
  $('#c-name').title = c.name;
  const years = c.projects.map((p) => p[5]).filter((y): y is number => y != null);
  $('#c-sub').innerHTML = `${/^\d+$/.test(c.id) ? `${term('pcab', 'Philippine Contractors Accreditation Board (PCAB) licence')} no. ${esc(c.id)}` : 'No licence number listed'}.${years.length ? ` Projects from budget years ${Math.min(...years)}–${Math.max(...years)}.` : ''}${c.revoked ? ' <span class="pill">Licence listed as revoked in DPWH data</span>' : ''}`;
  if (c.aliases) $('#c-aliases').textContent = `Also listed in DPWH data as: ${c.aliases.filter((a) => a !== c.name).join('; ')}`;

  const byYear = new Map<number, number>();
  const byCat = new Map<string, number>();
  for (const p of c.projects) {
    const amt = p[4] / Math.max(1, p[7]);
    if (p[5] != null) byYear.set(p[5], (byYear.get(p[5]) ?? 0) + amt);
    byCat.set(p[2], (byCat.get(p[2]) ?? 0) + amt);
  }
  const done = c.projects.filter((p) => p[3] === 'completed').length;
  const known = c.projects.filter((p) => p[3] !== 'unknown').length;
  $('#c-tiles').innerHTML = `
    <div class="card tile"><div class="label">Total awarded, all years</div><div class="value num">${fmtPesoCompact(c.total)}</div><div class="context">${c.jv ? `includes an equal share of ${c.jv} ${term('joint-venture', 'joint-venture')} contracts` : 'no joint ventures'}</div></div>
    <div class="card tile"><div class="label">Projects</div><div class="value num">${c.n.toLocaleString()}</div><div class="context">${done} completed of ${known} with known status</div></div>
    <div class="card tile"><div class="label">Cities & municipalities</div><div class="value num">${c.lgus.length}</div><div class="context">${fmtPct(c.total ? c.mappedTotal / c.total : null)} of the amount could be ${term('confidence', 'placed')} in a city or town</div></div>`;

  const yMax = Math.max(1, ...byYear.values());
  const ys = [...byYear.keys()].sort();
  $('#c-years').innerHTML = `<div class="bars">${ys.map((y) => `<div class="bar-row"><span class="num">${y}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${(100 * byYear.get(y)!) / yMax}%"></span></span><span class="v num">${fmtPesoCompact(byYear.get(y)!)}</span></div>`).join('')}</div>
    <div class="bars" style="margin-top:16px">${CATEGORIES.filter((k) => byCat.get(k)).map((k) => `<div class="bar-row"><span>${CATEGORY_LABEL[k]}</span><span class="bar-track"><span class="bar-fill" style="display:block;background:var(--c2);width:${(100 * byCat.get(k)!) / Math.max(...byCat.values())}%"></span></span><span class="v num">${fmtPesoCompact(byCat.get(k)!)}</span></div>`).join('')}</div>`;

  $('#c-lgus').innerHTML = c.lgus.length
    ? `<div class="table-wrap"><table><thead><tr><th>City / municipality</th><th class="r">Projects</th><th class="r">Amount</th><th class="r">Share of the town's DPWH money</th></tr></thead><tbody>${
        c.lgus.map((l) => `<tr><td><a href="/lgu/${l.psgc}/">${esc(l.name)}</a><div class="faint small">${esc(l.prov)}</div></td><td class="r num">${l.n}</td><td class="r num">${fmtPesoCompact(l.spend)}</td><td class="r num">${fmtPct(l.share, 1)}</td></tr>`).join('')
      }</tbody></table></div><p class="faint small" style="margin-top:8px">Share = this contractor's amount ÷ all DPWH project cost placed in that city or town, all years 2016–2026.</p>`
    : '<p class="muted">None of this contractor\'s projects could be placed in a city or municipality.</p>';

  let showAll = false;
  const renderProjects = () => {
    const shown = showAll ? c.projects : c.projects.slice(0, 50);
    $('#c-projects').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Year</th><th>Project</th><th>Where</th><th>Status</th><th class="r">Cost</th></tr></thead><tbody>${
      shown.map((p) => {
        const l = p[6] ? c.lgus.find((x) => x.psgc === p[6]) : null;
        return `<tr><td class="num">${p[5] ?? '—'}</td><td class="desc">${esc(p[1])}<div class="faint small">${esc(p[0])} · ${CATEGORY_LABEL[p[2]]}${p[7] > 1 ? ` · joint venture (${p[7]} partners)` : ''}</div></td><td>${l ? `<a href="/lgu/${l.psgc}/">${esc(l.name)}</a>` : '<span class="faint">not placed</span>'}</td><td><span class="pill">${STATUS_LABEL[p[3]]}</span></td><td class="r num">${p[4] ? fmtPesoCompact(p[4]) : '—'}</td></tr>`;
      }).join('')
    }</tbody></table></div>${c.projects.length > shown.length ? `<p style="margin-top:10px"><button class="btn" id="more">Show all ${c.projects.length} projects</button></p>` : ''}`;
    document.getElementById('more')?.addEventListener('click', () => { showAll = true; renderProjects(); });
  };
  renderProjects();
  linkFirstTerms();
}
