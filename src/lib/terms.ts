// Glossary terms. Every page marks occurrences with term(); only the first occurrence of each term on a
// page keeps its link (see client/terms.ts), so pages stay readable without a sea of underlines.

export const TERMS = {
  poverty: 'Poverty incidence and the poverty line',
  'income-class': 'Income class',
  psgc: 'PSGC (Philippine Standard Geographic Code)',
  'budget-year': 'Budget year vs. construction year',
  dpwh: 'DPWH (Department of Public Works and Highways)',
  deo: 'District Engineering Office (DEO)',
  lgu: 'LGU (local government unit)',
  'peer-group': 'Peer group',
  'typical-peer': 'Typical peer (median)',
  confidence: 'Placed / confidence',
  'joint-venture': 'Joint venture split rule',
  barmm: 'BARMM (Bangsamoro region)',
  pcab: 'PCAB (Philippine Contractors Accreditation Board) licence',
} as const;
export type TermKey = keyof typeof TERMS;

/** A glossary link. `html` must already be escaped. */
export function term(key: TermKey, html: string): string {
  return `<a class="term" data-term="${key}" href="/glossary/#${key}">${html}</a>`;
}

/** Link glossary words inside an already-escaped sentence (e.g. the generated headline). */
export function termify(html: string, rules: [RegExp, TermKey][]): string {
  for (const [re, key] of rules) html = html.replace(re, (m) => term(key, m));
  return html;
}

export const HEADLINE_TERMS: [RegExp, TermKey][] = [[/income class/, 'income-class'], [/budget years?/, 'budget-year'], [/\bPoverty\b/, 'poverty']];
