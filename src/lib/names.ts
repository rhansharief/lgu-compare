// Display casing for contractor names, which DPWH publishes in ALL CAPS. The raw name stays in
// tooltips and links; this is for reading only. Initials and acronyms (L.S.D., RMT, H2, OPC) stay upper case.

const LOWER = new Set(['AND', 'OF', 'THE', 'FOR', 'DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);
const WORDS = new Set(['INC', 'CO', 'CORP', 'LTD', 'ENT', 'SON', 'SONS', 'SAN', 'STA', 'STO']);
const KEEP = new Set(['OPC', 'JV']);

function word(run: string, first: boolean): string {
  if (/\d/.test(run) || run.length === 1 || KEEP.has(run)) return run;
  if (!first && LOWER.has(run)) return run.toLowerCase();
  const title = run[0] + run.slice(1).toLowerCase();
  if (WORDS.has(run)) return title;
  if (!/[AEIOUY]/.test(run)) return run; // no vowels: RMT, HGG, CLTG, FFJJ
  if (run.length === 2) return ['CO', 'DE', 'LA', 'EL', 'DI', 'DA', 'SA', 'NG'].includes(run) ? title : run; // RC, AB, AN (initials)
  // 3 letters that don't read as a word (AKN, OPC): keep as an acronym. SUN, BAY, ACE, TOP read as words.
  if (run.length === 3 && !/^[^AEIOU][AEIOUY][^AEIOU]$|^[AEIOU][^AEIOU][AEIOU]$/.test(run)) return run;
  return title;
}

export function titleCase(name: string): string {
  if (/\p{Ll}/u.test(name)) return name; // already mixed case
  let first = true;
  return name.replace(/[\p{Lu}\p{N}]+/gu, (run) => {
    const out = word(run, first);
    first = false;
    return out;
  });
}
