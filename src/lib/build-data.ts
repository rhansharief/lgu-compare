// Build-time access to the emitted index (read once per build, not once per page).
import { readFileSync } from 'node:fs';

export const buildIndex = JSON.parse(readFileSync('public/data/index.json', 'utf8'));
