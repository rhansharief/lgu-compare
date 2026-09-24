/** Contractors are sharded into 256 JSON files; this picks the file for an id. */
export function contractorBucket(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 256).toString(16).padStart(2, '0');
}
