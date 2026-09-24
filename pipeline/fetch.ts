// Step 1: download every DPWH project page from the BetterGov proxy to disk.
// Re-running skips pages already on disk; delete data/raw/dpwh/pages to refetch.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.dpwh.bettergov.ph/projects';
const LIMIT = 5000;
const DIR = 'data/raw/dpwh/pages';

async function getPage(page: number): Promise<any> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${API}?page=${page}&limit=${LIMIT}`, {
        headers: { 'User-Agent': 'lgu-compare-pipeline/0.1 (civic-tech, non-profit)' },
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.code !== 'SUCCESS') throw new Error(`API code ${body.code}`);
      return body.data;
    } catch (err) {
      console.error(`page ${page} attempt ${attempt}: ${err}`);
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
  throw new Error(`page ${page} failed after retries`);
}

mkdirSync(DIR, { recursive: true });
const first = await getPage(1);
const { totalCount, totalPages } = first.pagination;
if (first.pagination.limit !== LIMIT) throw new Error(`API capped limit at ${first.pagination.limit}`);
console.log(`${totalCount} projects over ${totalPages} pages`);

for (let p = 1; p <= totalPages; p++) {
  const file = join(DIR, `page_${String(p).padStart(3, '0')}.json`);
  if (existsSync(file)) continue;
  const data = p === 1 ? first : await getPage(p);
  writeFileSync(file, JSON.stringify({ data }));
  console.log(`page ${p}/${totalPages}: ${data.data.length} rows`);
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
let rowsOnDisk = 0;
for (const f of files) rowsOnDisk += JSON.parse(readFileSync(join(DIR, f), 'utf8')).data.data.length;
const sums = files.map((f) => `${createHash('sha256').update(readFileSync(join(DIR, f))).digest('hex')}  pages/${f}`);
writeFileSync('data/raw/dpwh/PAGES.SHA256SUMS', sums.join('\n') + '\n');
writeFileSync(
  'data/raw/dpwh/manifest.json',
  JSON.stringify({ source: API, fetchedAt: new Date().toISOString(), totalCountReported: totalCount, rowsOnDisk, totalPages, limit: LIMIT }, null, 2) + '\n',
);
