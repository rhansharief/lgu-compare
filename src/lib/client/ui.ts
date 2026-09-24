// Small shared UI pieces: status icons and warning chips.

export const ICON = {
  warn: '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6v3.6M8 11.4v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  worse: '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.6v4.2M8 11.2v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  better: '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m5 8.2 2 2 4-4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  same: '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 8h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

/** Shown next to the scatter title: province-level poverty makes dots stack in columns. `noun` is plural ("cities"). */
export function provWarning(provLevel: number, n: number, noun = 'places') {
  return `<div class="warn-chip">${ICON.warn}Province-wide poverty figures</div>
    <p class="warn-text">For ${provLevel === n ? `all ${n}` : `${provLevel} of these ${n}`} ${provLevel === n ? `of these ${noun}` : noun} we only know the poverty figure for their whole province, so ${noun} in the same province sit in a vertical line.</p>`;
}
