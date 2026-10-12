// Adds an honest <lastmod> to every sitemap URL. A page keeps its previous
// lastmod while its built HTML hash matches the live manifest, and gets
// today's UTC date when it is new or its content changed. Dates are kept in
// dist/lastmod.json so the next deploy can carry them forward. Run after build
// as the last build step (it reads the live site, so it needs network).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const live = 'https://pickyourrow.com';
const today = new Date().toISOString().slice(0, 10);

async function getJson(path) {
  try {
    const res = await fetch(`${live}${path}`, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (e) {
    console.log(`${path} unavailable: ${e.message}`);
  }
  return {};
}

const fresh = JSON.parse(readFileSync(join(dist, 'indexnow-manifest.json'), 'utf8'));
const liveManifest = await getJson('/indexnow-manifest.json');
const liveLastmod = await getJson('/lastmod.json');

const lastmod = {};
let kept = 0;
for (const [url, hash] of Object.entries(fresh)) {
  if (liveManifest[url] === hash && /^\d{4}-\d{2}-\d{2}$/.test(liveLastmod[url] || '')) {
    lastmod[url] = liveLastmod[url];
    kept++;
  } else {
    lastmod[url] = today;
  }
}
writeFileSync(join(dist, 'lastmod.json'), JSON.stringify(lastmod));

let tagged = 0;
for (const f of readdirSync(dist).filter((n) => /^sitemap-\d+\.xml$/.test(n))) {
  const file = join(dist, f);
  const xml = readFileSync(file, 'utf8').replace(/<loc>([^<]+)<\/loc>/g, (m, loc) => {
    if (!lastmod[loc]) return m;
    tagged++;
    return `${m}<lastmod>${lastmod[loc]}</lastmod>`;
  });
  writeFileSync(file, xml);
}
console.log(`sitemap lastmod: ${tagged} URLs tagged, ${kept} kept, ${tagged - kept} set to ${today}`);
if (tagged === 0) process.exit(1);
