// Rebuilds src/data/lastmod-seed.json from the current source files and git blame.
// Run after content edits and before commit. CI uses the committed seed when the
// live content hash is not available yet.
import { writeFileSync } from 'node:fs';
import { contentDates, contentHashes } from './content-fingerprint.mjs';

const today = new Date().toISOString().slice(0, 10);
const hashes = contentHashes();
const dates = contentDates(today);
const seed = {};
for (const [url, hash] of Object.entries(hashes)) {
  seed[url] = { date: dates[url] || today, hash };
}
writeFileSync('src/data/lastmod-seed.json', `${JSON.stringify(seed, null, 2)}\n`);
const unique = new Set(Object.values(seed).map((item) => item.date));
console.log(`lastmod seed: ${Object.keys(seed).length} URLs, ${unique.size} distinct dates`);
