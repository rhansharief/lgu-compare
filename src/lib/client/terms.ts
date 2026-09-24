// Keep only the first glossary link per term on the page (in document order). Later occurrences lose
// their href and read as plain text. Safe to call again after any re-render.
export function linkFirstTerms(root: ParentNode = document) {
  const seen = new Set<string>();
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[data-term]')) {
    const key = a.dataset.term!;
    if (seen.has(key)) a.removeAttribute('href');
    else { seen.add(key); a.setAttribute('href', `/glossary/#${key}`); }
  }
}
