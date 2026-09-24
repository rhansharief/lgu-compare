// Need vs money scatter: x = poverty incidence, y = spend per resident, size = population.
// At most 3 colors: highlighted LGU, group 1, group 2.
import * as Plot from '@observablehq/plot';
import { Delaunay } from 'd3';
import { fmtPeso, median } from '../metrics.ts';
import { esc } from './data.ts';

export interface Point {
  psgc: string;
  name: string;
  prov: string;
  x: number; // poverty %
  y: number; // PHP per resident
  pop: number;
  group: 0 | 1 | 2; // index into opts.colors
  hl: boolean; // the selected LGU: drawn on top and labelled
  povLevel: 'lgu' | 'prov' | null;
  povYear: number | null;
}

export interface ScatterOpts {
  groupLabels: [string, string, string];
  /** CSS custom properties for groups 0, 1, 2 */
  colors: [string, string, string];
  log: boolean;
  onPick?: (p: Point) => void;
  yLabel: string;
  /** Defaults to the poverty % label. */
  xLabel?: string;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function renderScatter(el: HTMLElement, points: Point[], opts: ScatterOpts): { medX: number | null; medY: number | null; over: number; cap: number | null } {
  el.innerHTML = '';
  const width = Math.max(300, el.clientWidth);
  const narrow = width < 560;
  const height = Math.round(Math.min(560, Math.max(340, width * 0.72)));
  const pts = opts.log ? points.filter((p) => p.y > 0) : points;
  const medX = median(points.map((p) => p.x));
  const medY = median(points.map((p) => p.y));
  const colors = opts.colors.map(css);
  const hlColor = css('--hl');
  const grid = css('--grid');
  const text3 = css('--text-3');
  const surface = css('--surface');

  const xMax = Math.max(10, Math.ceil((Math.max(...pts.map((p) => p.x), 0) + 2) / 10) * 10);
  const yVals = pts.map((p) => p.y);
  // On a linear scale a few extreme LGUs would squash everyone else to the floor: cap the axis
  // near the 97th percentile and draw the ones above it as ▲ on the top edge (tooltip keeps the true value).
  const sorted = [...yVals].sort((a, b) => a - b);
  const p97 = sorted[Math.floor(sorted.length * 0.97)] ?? 0;
  const trueMax = Math.max(...yVals, 1);
  const capped = !opts.log && sorted.length > 30 && trueMax > p97 * 2 ? p97 * 1.25 : null;
  const yMax = (capped ?? trueMax) * (capped != null || narrow ? 1.28 : 1.14); // headroom for the quadrant labels
  const plotY = (p: Point) => (capped != null && p.y > capped ? capped * 1.04 : p.y);
  const over = capped != null ? pts.filter((p) => p.y > capped) : [];
  const yMin = opts.log ? Math.max(1, Math.min(...yVals) / 1.5) : 0;

  const hl = pts.filter((p) => p.hl);
  const rMax = narrow ? 13 : 18;
  const popMax = Math.max(...points.map((p) => p.pop), 1);
  const hlRadius = hl.length ? Math.sqrt(hl[0].pop / popMax) * rMax : 0;
  const rest = pts.filter((p) => !p.hl).sort((a, b) => b.pop - a.pop); // big dots underneath
  const quad = (label: string, fx: 'left' | 'right', fy: 'top' | 'bottom') =>
    Plot.text([narrow ? label.replace(', ', ',\n') : label], { frameAnchor: `${fy}-${fx}` as any, dx: fx === 'left' ? 6 : -6, dy: fy === 'top' ? 6 : -6, fill: text3, fontSize: narrow ? 10 : 11.5, stroke: surface, strokeWidth: 3, paintOrder: 'stroke' });

  const plot = Plot.plot({
    width,
    height,
    marginLeft: narrow ? 52 : 64,
    marginRight: 12,
    marginTop: 14,
    marginBottom: 42,
    style: { background: 'transparent', color: text3, fontSize: narrow ? '11px' : '12px', fontFamily: 'inherit' },
    x: { domain: [0, xMax], label: opts.xLabel ?? 'Poverty (% of people below the poverty line) →', labelAnchor: 'center', tickFormat: (d: number) => `${d}%`, ticks: narrow ? 5 : 10 },
    y: {
      type: opts.log ? 'log' : 'linear',
      domain: [yMin, yMax],
      label: opts.yLabel,
      labelAnchor: 'top',
      tickFormat: (d: number) => (d >= 1000 ? `₱${d / 1000}k` : `₱${d}`),
      ticks: opts.log ? undefined : 6,
      grid: false,
    },
    r: { type: 'sqrt', domain: [0, popMax], range: [0, rMax] },
    marks: [
      Plot.gridY({ stroke: grid, strokeOpacity: 1, ticks: opts.log ? undefined : 6 }),
      medX != null ? Plot.ruleX([medX], { stroke: text3, strokeDasharray: '4,4', strokeOpacity: 0.8 }) : null,
      medY != null ? Plot.ruleY([medY], { stroke: text3, strokeDasharray: '4,4', strokeOpacity: 0.8 }) : null,
      Plot.dot(rest.filter((d) => !over.includes(d)), { x: 'x', y: 'y', r: 'pop', fill: (d: Point) => colors[d.group], fillOpacity: 0.78, stroke: surface, strokeWidth: 0.8 }),
      Plot.dot(over.filter((d) => !d.hl), { x: 'x', y: plotY, symbol: 'triangle', r: narrow ? 4 : 5, fill: (d: Point) => colors[d.group], fillOpacity: 0.9 }),
      // corner labels above the ordinary dots (with a halo) but under the highlighted LGU
      ...QUADRANTS.map((q) => quad(q.label, q.poorer ? 'right' : 'left', q.more ? 'top' : 'bottom')),
      Plot.dot(hl, { x: 'x', y: plotY, r: (d: Point) => Math.max(d.pop, 1), fill: hlColor, stroke: surface, strokeWidth: 1.5, symbol: (d: Point) => (over.includes(d) ? 'triangle' : 'circle') }),
      Plot.dot(hl, { x: 'x', y: plotY, r: 3.5, fill: hlColor }),
      ...(['start', 'end'] as const).map((anchor) =>
        Plot.text(hl.filter((d) => (d.x > xMax * 0.7) === (anchor === 'end')), {
          x: 'x', y: plotY, text: 'name', dx: (anchor === 'end' ? -1 : 1) * (hlRadius + 6), textAnchor: anchor,
          fill: css('--text'), fontWeight: 700, fontSize: narrow ? 12 : 13, stroke: surface, strokeWidth: 4, paintOrder: 'stroke',
        }),
      ),
    ].filter(Boolean) as Plot.Markish[],
  });
  el.appendChild(plot);

  // Tooltip: nearest dot (Delaunay), works for mouse and touch.
  const xs = plot.scale('x')!, ys = plot.scale('y')!;
  const px = pts.map((p) => [xs.apply(p.x) as number, ys.apply(plotY(p)) as number] as [number, number]);
  const delaunay = Delaunay.from(px);
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  el.appendChild(tip);
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', css('--text'));
  ring.setAttribute('stroke-width', '1.5');
  ring.style.display = 'none';
  plot.appendChild(ring);

  let current: Point | null = null;
  const show = (ev: PointerEvent) => {
    const rect = (plot as SVGSVGElement).getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * width;
    const my = ((ev.clientY - rect.top) / rect.height) * height;
    const i = delaunay.find(mx, my);
    if (i < 0 || Math.hypot(px[i][0] - mx, px[i][1] - my) > 40) { hide(); return; }
    const p = pts[i];
    current = p;
    ring.setAttribute('cx', String(px[i][0]));
    ring.setAttribute('cy', String(px[i][1]));
    ring.setAttribute('r', String(Math.max(6, (plot.scale('r')!.apply(p.pop) as number) + 3)));
    ring.style.display = '';
    tip.innerHTML = `<b>${esc(p.name)}</b><br><span class="faint">${esc(p.prov)}</span><br>
      ${fmtPeso(p.y)} per person<br>
      Poverty ${p.x.toFixed(1)}%${p.povLevel === 'prov' ? ' (province-wide)' : ''}<br>
      Population ${p.pop.toLocaleString('en-PH')}${opts.onPick ? '<br><span class="faint">Click to open</span>' : ''}`;
    tip.hidden = false;
    const left = (px[i][0] / width) * rect.width;
    const top = (px[i][1] / height) * rect.height;
    tip.style.left = `${Math.min(left + 14, rect.width - 200)}px`;
    tip.style.top = `${Math.max(0, top - 10)}px`;
  };
  const hide = () => { tip.hidden = true; ring.style.display = 'none'; current = null; };
  plot.addEventListener('pointermove', show as EventListener);
  plot.addEventListener('pointerdown', show as EventListener);
  plot.addEventListener('pointerleave', hide);
  plot.addEventListener('click', () => { if (current && opts.onPick) opts.onPick(current); });
  if (opts.onPick) (plot as SVGElement).style.cursor = 'pointer';

  return { medX, medY, over: over.length, cap: capped };
}

/** Corners of the chart, split at the peer medians. Relative to the typical peer, never absolute. */
export const QUADRANTS = [
  { key: 'poorerMore', label: 'Poorer, gets more money', poorer: true, more: true },
  { key: 'poorerLess', label: 'Poorer, gets less money', poorer: true, more: false },
  { key: 'betterMore', label: 'Better-off, gets more money', poorer: false, more: true },
  { key: 'betterLess', label: 'Better-off, gets less money', poorer: false, more: false },
] as const;

export function quadrantOf(p: Pick<Point, 'x' | 'y'>, medX: number, medY: number) {
  return QUADRANTS.find((q) => q.poorer === p.x >= medX && q.more === p.y >= medY)!;
}

export function legendHtml(labels: string[], present: boolean[], vars: string[]): string {
  return labels
    .map((l, i) => (present[i] && l ? `<span><i style="background:var(${vars[i]})"></i>${esc(l)}</span>` : ''))
    .join('');
}
