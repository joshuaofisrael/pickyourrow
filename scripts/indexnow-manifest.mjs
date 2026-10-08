// Writes dist/indexnow-manifest.json: a sha256 per sitemap URL of its built HTML.
// The deploy workflow compares it with the live manifest so only new or changed
// pages are pinged to IndexNow (Bing, Yandex and other participating engines).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const dist = 'dist';
const site = 'https://pickyourrow.com';
const urls = [];
for (const f of readdirSync(dist).filter((n) => /^sitemap-\d+\.xml$/.test(n))) {
  const xml = readFileSync(join(dist, f), 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1]);
}
const manifest = {};
for (const url of urls) {
  const path = url.slice(site.length);
  const file = join(dist, path, 'index.html');
  // v2 makes the manifest from the first deploy stale. That deploy published
  // the file before IndexNow could read the key (HTTP 403), so this prefix
  // submits every sitemap URL once on the following deploy.
  manifest[url] = createHash('sha256').update('v2\n').update(readFileSync(file)).digest('hex');
}
writeFileSync(join(dist, 'indexnow-manifest.json'), JSON.stringify(manifest));
console.log(`indexnow manifest: ${urls.length} URLs`);
if (urls.length === 0) process.exit(1);
