// Compares the freshly built manifest with the one currently live and writes
// indexnow-urls.json with every new or changed URL. Run before deploy.
import { readFileSync, writeFileSync } from 'node:fs';

const fresh = JSON.parse(readFileSync('dist/indexnow-manifest.json', 'utf8'));
let live = {};
try {
  const res = await fetch('https://pickyourrow.com/indexnow-manifest.json', { cache: 'no-store' });
  if (res.ok) live = await res.json();
} catch (e) {
  console.log(`live manifest unavailable: ${e.message}`);
}
const changed = Object.keys(fresh).filter((u) => live[u] !== fresh[u]);
writeFileSync('indexnow-urls.json', JSON.stringify(changed));
console.log(`indexnow: ${changed.length} new or changed of ${Object.keys(fresh).length}`);
