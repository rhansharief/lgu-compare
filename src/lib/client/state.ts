// Read/write view state in the URL so every view is linkable.
import { PEER_MODES, PRESET_IDS, customPeriod, periodById, CURRENT_YEAR, FIRST_DATA_YEAR, type CategoryFilter, type PeerMode, type PeriodDef } from '../metrics.ts';

export interface ViewState { peer: PeerMode; period: string; from: number; to: number; cat: CategoryFilter; lgu: string | null; log: boolean }

export function readState(defaults: Partial<ViewState> = {}): ViewState {
  const q = new URLSearchParams(location.search);
  const peer = (q.get('peer') as PeerMode) ?? defaults.peer ?? 'class';
  const period = q.get('period') ?? defaults.period ?? 'last3';
  const cat = (q.get('cat') as CategoryFilter) ?? defaults.cat ?? 'all';
  return {
    peer: PEER_MODES.some((m) => m.id === peer) ? peer : 'class',
    period: PRESET_IDS.includes(period) || period === 'custom' ? period : 'last3',
    from: clampYear(Number(q.get('from')) || 2019),
    to: clampYear(Number(q.get('to')) || 2025),
    cat: ['all', 'flood', 'roads', 'buildings', 'other'].includes(cat) ? cat : 'all',
    lgu: q.get('lgu') ?? defaults.lgu ?? null,
    log: q.get('scale') === 'log',
  };
}

const clampYear = (y: number) => Math.max(FIRST_DATA_YEAR, Math.min(CURRENT_YEAR, y));

export function writeState(s: ViewState, keys: (keyof ViewState)[]) {
  const q = new URLSearchParams();
  for (const k of keys) {
    if (k === 'from' || k === 'to') { if (s.period === 'custom') q.set(k, String(s[k])); continue; }
    if (k === 'log') { if (s.log) q.set('scale', 'log'); continue; }
    const v = s[k];
    if (v != null && v !== '') q.set(k, String(v));
  }
  history.replaceState(null, '', `${location.pathname}?${q}`);
}

export function periodOf(s: ViewState): PeriodDef {
  return s.period === 'custom' ? customPeriod(s.from, s.to) : periodById(s.period)!;
}
