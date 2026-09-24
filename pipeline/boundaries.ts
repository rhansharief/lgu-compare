// Adapter for the municipal boundary file (see docs/boundaries-source.md).
export function psgcFromFeature(f: any): string | null {
  const c = f?.properties?.psgc;
  return typeof c === 'string' && /^\d{10}$/.test(c) ? c : null;
}
