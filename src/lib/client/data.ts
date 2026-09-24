// Fetch + cache the emitted JSON.
import type { Category, LguIndexRow } from '../metrics.ts';
import { contractorBucket } from '../buckets.ts';

export interface Coverage { n: number; mapped: number; value: number; mappedValue: number }
export interface Source { name: string; url: string; fetched: string; rows?: number }
export interface IndexRow extends LguIndexRow { conf: { high: number; medium: number; low: number }; n: number }
export interface IndexFile {
  generatedAt: string;
  sources: Record<'dpwh' | 'psgc' | 'poverty', Source>;
  national: Coverage;
  regionCoverage: Record<string, Coverage>;
  lgus: IndexRow[];
}
export type Status = 'completed' | 'ongoing' | 'procurement' | 'notstarted' | 'terminated' | 'unknown';
/** [id, desc, cat, status, budget, year, contractorIds, conf, method, start, end] */
export type LguProject = [string, string, Category, Status, number, number | null, string[], string | null, string | null, string | null, string | null];
export interface LguFile { psgc: string; contractors: Record<string, string>; projects: LguProject[] }
/** [id, desc, cat, status, budget, year, psgc, partners] */
export type ContractorProject = [string, string, Category, Status, number, number | null, string | null, number];
export interface ContractorFile {
  id: string; name: string; aliases?: string[]; revoked?: boolean; total: number; mappedTotal: number; n: number; jv: number;
  lgus: { psgc: string; name: string; prov: string; spend: number; n: number; share: number | null }[];
  projects: ContractorProject[];
}

const cache = new Map<string, Promise<any>>();
function get<T>(url: string): Promise<T> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }));
  return cache.get(url)!;
}
export const loadIndex = () => get<IndexFile>('/data/index.json');
export const loadLgu = (psgc: string) => get<LguFile>(`/data/lgu/${psgc}.json`);
export async function loadContractor(id: string): Promise<ContractorFile | null> {
  const bucket = await get<Record<string, ContractorFile>>(`/data/contractor/${contractorBucket(id)}.json`);
  return bucket[id] ?? null;
}

export const STATUS_LABEL: Record<Status, string> = {
  completed: 'Completed', ongoing: 'On-going', procurement: 'For procurement', notstarted: 'Not yet started', terminated: 'Terminated', unknown: 'Unknown',
};

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
