// Text matching of DPWH project descriptions to PSGC cities/municipalities.
import type { Lgu } from './psa.ts';
import { placeKey, DPWH_REGION } from './psa.ts';
import { normName } from './parse.ts';

export interface TextMatch {
  psgc: string;
  /** true when the province was also named in the text (or implied by an unambiguous city name) */
  provinceConfirmed: boolean;
  segment: string;
}

export class TextMatcher {
  private byKey = new Map<string, Lgu[]>();
  private provKeys = new Map<string, { regCode: number; provPsgc: string }[]>(); // key → provinces

  constructor(lgus: Lgu[], provinces: { psgc: string; name: string; regCode: number }[]) {
    for (const p of provinces) {
      const k = placeKey(p.name);
      if (!this.provKeys.has(k)) this.provKeys.set(k, []);
      this.provKeys.get(k)!.push({ regCode: p.regCode, provPsgc: p.psgc });
    }
    // Common spellings in DPWH descriptions
    const alias: [string, string][] = [
      ['MT PROVINCE', 'MOUNTAIN PROVINCE'],
      ['MOUNTAIN PROV', 'MOUNTAIN PROVINCE'],
      ['COMPOSTELA VALLEY', 'DAVAO DE ORO'],
      ['MINDORO OCCIDENTAL', 'OCCIDENTAL MINDORO'],
      ['MINDORO ORIENTAL', 'ORIENTAL MINDORO'],
      ['NORTH COTABATO', 'COTABATO'],
      ['WESTERN SAMAR', 'SAMAR'],
      ['MIS OR', 'MISAMIS ORIENTAL'],
      ['MIS OCC', 'MISAMIS OCCIDENTAL'],
      ['ZAMBO SUR', 'ZAMBOANGA DEL SUR'],
      ['ZAMBO NORTE', 'ZAMBOANGA DEL NORTE'],
      ['ZAMBO SIBUGAY', 'ZAMBOANGA SIBUGAY'],
      ['TAWI TAWI', 'TAWI TAWI'],
      ['SAMAR PROVINCE', 'SAMAR'],
    ];
    for (const [a, b] of alias) if (this.provKeys.has(b)) this.provKeys.set(a, this.provKeys.get(b)!);

    const lguAlias: Record<string, string> = { 'LEGASPI CITY': 'LEGAZPI CITY', LEGASPI: 'LEGAZPI CITY', JETAFE: 'GETAFE', 'GEN SANTOS': 'GENERAL SANTOS CITY', 'GENSAN': 'GENERAL SANTOS CITY' };
    for (const l of lgus) {
      for (const [a, b] of Object.entries(lguAlias)) if (lguKeys(l).includes(b)) (this.byKey.get(a) ?? this.byKey.set(a, []).get(a)!).push(l);
      for (const k of lguKeys(l)) {
        if (this.provKeys.has(k) && l.kind === 'Mun') continue; // never let a muni shadow a province name
        if (!this.byKey.has(k)) this.byKey.set(k, []);
        this.byKey.get(k)!.push(l);
      }
    }
  }

  private provinceIn(seg: string, regCodes: number[] | null): { rest: string; provPsgcs: string[] } | null {
    // exact segment or segment ending with a province name ("MATI DAVAO ORIENTAL")
    for (const [k, provs] of this.provKeys) {
      const ok = provs.filter((p) => regCodes == null || regCodes.includes(p.regCode));
      if (!ok.length) continue;
      if (seg === k) return { rest: '', provPsgcs: ok.map((p) => p.provPsgc) };
      if (seg.endsWith(' ' + k)) return { rest: seg.slice(0, -k.length - 1).trim(), provPsgcs: ok.map((p) => p.provPsgc) };
    }
    return null;
  }

  match(description: string, dpwhRegion: string | null): TextMatch | null {
    const regCodes = regionsFor(dpwhRegion);
    const segs = description
      .split(/[,;]/)
      .map((s) => normName(s.replace(/\bPROV(INCE)?\b\.?$/i, '').trim()))
      .filter(Boolean)
      .reverse()
      .slice(0, 5);

    let provPsgcs: string[] | null = null;
    for (const raw of segs) {
      let seg = raw;
      const pv = this.provinceIn(seg, regCodes);
      if (pv) {
        provPsgcs = pv.provPsgcs;
        if (!pv.rest) continue;
        seg = pv.rest;
      }
      const key = placeKey(seg.replace(/^(MUNICIPALITY OF|MUN OF|TOWN OF)\s+/, ''));
      let cands = this.byKey.get(key);
      if (!cands && provPsgcs) {
        // "BARANGAY TAYTAYAN CATEEL" → try the last 1–3 words as a name inside the named province.
        const words = seg.split(' ');
        for (let n = Math.min(3, words.length - 1); n >= 1 && !cands; n--) {
          const inProv = (this.byKey.get(placeKey(words.slice(-n).join(' '))) ?? []).filter(
            (c) => c.provPsgc && provPsgcs!.includes(c.provPsgc),
          );
          if (inProv.length === 1) return { psgc: inProv[0].psgc, provinceConfirmed: true, segment: raw };
        }
      }
      if (!cands) continue;
      if (regCodes != null) cands = cands.filter((c) => regCodes.includes(c.regCode));
      if (provPsgcs) {
        const inProv = cands.filter((c) => c.provPsgc && provPsgcs!.includes(c.provPsgc));
        if (inProv.length === 1) return { psgc: inProv[0].psgc, provinceConfirmed: true, segment: raw };
        if (inProv.length > 1) return null;
        // Named province doesn't contain it: the segment is probably a barangay; keep looking.
        continue;
      }
      if (cands.length === 1) {
        // Unique name in the region; cities are unique enough to count as confirmed.
        return { psgc: cands[0].psgc, provinceConfirmed: cands[0].kind === 'City', segment: raw };
      }
      if (cands.length > 1) return null; // ambiguous without a province
    }
    return null;
  }
}

/** Name variants an LGU can appear under in DPWH descriptions. */
export function lguKeys(l: Pick<Lgu, 'name' | 'kind'>): string[] {
  const keys = new Set<string>();
  const k = placeKey(l.name); // "City of Mati" → "MATI CITY"
  keys.add(k);
  if (l.kind === 'City') {
    const base = k.replace(/ CITY$/, '');
    keys.add(base);
    keys.add(`CITY OF ${base}`);
  }
  // "Santo Tomas" / "Sto Tomas" already normalised; add no-space variants for names like "Lapu-Lapu"
  keys.add(k.replace(/ /g, ''));
  return [...keys];
}

/**
 * PSGC region codes a DPWH region label may correspond to. DPWH offices don't follow every
 * boundary change: Cotabato City (BARMM) is still under DPWH Region XII, and Negros Island Region
 * projects predating 2024 may be labelled Region VI/VII.
 */
export function regionsFor(dpwhRegion: string | null): number[] | null {
  const r = dpwhRegion ? DPWH_REGION[dpwhRegion] : undefined;
  if (r == null) return null;
  if (r === 12) return [12, 19];
  if (r === 6 || r === 7) return [r, 18];
  if (r === 18) return [18, 6, 7];
  if (r === 10) return [10, 19];
  return [r];
}
