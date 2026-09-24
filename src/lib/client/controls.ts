// Chip controls for peer group, period and category. Mutates `state` and calls onChange.
import { CATEGORY_LABEL, CATEGORIES, CURRENT_YEAR, FIRST_DATA_YEAR, PEER_MODES, PRESET_IDS, periodById } from '../metrics.ts';
import type { ViewState } from './state.ts';

export function renderControls(el: HTMLElement, state: ViewState, opts: { category?: boolean; peers?: boolean }, onChange: () => void) {
  const years = Array.from({ length: CURRENT_YEAR - FIRST_DATA_YEAR + 1 }, (_, i) => FIRST_DATA_YEAR + i);
  const yearOpts = (sel: number) => years.map((y) => `<option ${y === sel ? 'selected' : ''}>${y}</option>`).join('');
  el.innerHTML = `
    ${opts.peers === false ? '' : `<div class="control-group" role="group" aria-label="Compare with">
      <span class="control-label">Compare with</span>
      ${PEER_MODES.map((m) => `<button class="chip" data-peer="${m.id}" aria-pressed="${state.peer === m.id}">${m.label}</button>`).join('')}
    </div>`}
    <div class="control-group" role="group" aria-label="Period">
      <span class="control-label">Period</span>
      ${PRESET_IDS.map((id) => `<button class="chip" data-period="${id}" aria-pressed="${state.period === id}">${periodById(id)!.label}</button>`).join('')}
      <button class="chip" data-period="custom" aria-pressed="${state.period === 'custom'}">Custom</button>
      <span class="custom-range ${state.period === 'custom' ? 'on' : ''}">
        <select data-from aria-label="From budget year">${yearOpts(state.from)}</select>–<select data-to aria-label="To budget year">${yearOpts(state.to)}</select>
      </span>
    </div>
    ${opts.category ? `<div class="control-group" role="group" aria-label="Category">
      <span class="control-label">Category</span>
      <button class="chip" data-cat="all" aria-pressed="${state.cat === 'all'}">All</button>
      ${CATEGORIES.map((c) => `<button class="chip" data-cat="${c}" aria-pressed="${state.cat === c}">${CATEGORY_LABEL[c]}</button>`).join('')}
    </div>` : ''}`;
  el.onclick = (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.peer) state.peer = b.dataset.peer as ViewState['peer'];
    else if (b.dataset.period) state.period = b.dataset.period;
    else if (b.dataset.cat) state.cat = b.dataset.cat as ViewState['cat'];
    else return;
    renderControls(el, state, opts, onChange);
    onChange();
  };
  el.onchange = () => {
    state.from = Number(el.querySelector<HTMLSelectElement>('[data-from]')!.value);
    state.to = Number(el.querySelector<HTMLSelectElement>('[data-to]')!.value);
    if (state.from > state.to) [state.from, state.to] = [state.to, state.from];
    onChange();
  };
}
