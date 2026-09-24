// Header search: type a city/municipality, jump to its page.
interface Entry { psgc: string; name: string; prov: string }

let entries: Entry[] | null = null;
async function load(): Promise<Entry[]> {
  if (!entries) entries = await fetch('/data/search.json').then((r) => r.json());
  return entries!;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/^city of /, '').trim();

export function initSearch(onPick?: (e: Entry) => void, root: ParentNode = document) {
  const box = root.querySelector<HTMLElement>('[data-search]');
  if (!box) return;
  const input = box.querySelector('input')!;
  const list = box.querySelector('ul')!;
  let items: Entry[] = [];
  let active = -1;

  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const pick = (e: Entry) => {
    close();
    input.value = `${e.name}, ${e.prov}`;
    if (onPick) onPick(e);
    else location.href = `/lgu/${e.psgc}/`;
  };
  const render = () => {
    list.innerHTML = '';
    items.forEach((e, i) => {
      const li = document.createElement('li');
      li.id = `opt-${e.psgc}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      li.innerHTML = `<span></span><span class="faint"></span>`;
      li.children[0].textContent = e.name;
      li.children[1].textContent = e.prov;
      li.addEventListener('mousedown', (ev) => { ev.preventDefault(); pick(e); });
      list.appendChild(li);
    });
    list.hidden = items.length === 0;
    input.setAttribute('aria-expanded', String(!list.hidden));
    if (active >= 0) input.setAttribute('aria-activedescendant', `opt-${items[active].psgc}`);
  };

  input.addEventListener('focus', () => { load(); });
  input.addEventListener('input', async () => {
    const q = norm(input.value);
    if (q.length < 2) { items = []; render(); return; }
    const all = await load();
    const starts: Entry[] = [], contains: Entry[] = [];
    for (const e of all) {
      const n = norm(e.name);
      if (n.startsWith(q)) starts.push(e);
      else if (n.includes(q) || norm(e.prov).startsWith(q)) contains.push(e);
    }
    items = [...starts, ...contains].slice(0, 12);
    active = items.length ? 0 : -1;
    render();
  });
  input.addEventListener('keydown', (ev) => {
    if (list.hidden) return;
    if (ev.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); render(); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); ev.preventDefault(); }
    else if (ev.key === 'Enter' && active >= 0) { pick(items[active]); ev.preventDefault(); }
    else if (ev.key === 'Escape') close();
  });
  input.addEventListener('blur', () => setTimeout(close, 100));
}
