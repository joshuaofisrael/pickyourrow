// Writes an honest <lastmod> for every sitemap URL.
// The date is the last change to that page's own content. A shared layout edit
// does not refresh the whole sitemap. Dates are carried in dist/lastmod.json
// and dist/content-hash.json so the next deploy can keep them.
// When the live content hash is missing (first deploy of this scheme, or a
// failed fetch), src/data/lastmod-seed.json supplies the date for unchanged pages.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { contentHashes, SITE } from './content-fingerprint.mjs';

const dist = 'dist';
const today = new Date().toISOString().slice(0, 10);

async function getJson(path) {
  try {
    const res = await fetch(`${SITE}${path}`, { cache: 'no-store' });
    if (res.ok) return await res.json();
    console.log(`${path} HTTP ${res.status}`);
  } catch (error) {
    console.log(`${path} unavailable: ${error.message}`);
  }
  return null;
}

const hashes = contentHashes();
const seed = JSON.parse(readFileSync('src/data/lastmod-seed.json', 'utf8'));
const liveHash = (await getJson('/content-hash.json')) ?? {};
const liveLastmod = (await getJson('/lastmod.json')) ?? {};

const lastmod = {};
let keptLive = 0;
let keptSeed = 0;
let stamped = 0;
let unknown = 0;
for (const [url, hash] of Object.entries(hashes)) {
  if (liveHash[url] === hash && /^\d{4}-\d{2}-\d{2}$/.test(liveLastmod[url] || '')) {
    lastmod[url] = liveLastmod[url];
    keptLive++;
  } else if (seed[url] && seed[url].hash === hash && /^\d{4}-\d{2}-\d{2}$/.test(seed[url].date || '')) {
    lastmod[url] = seed[url].date;
    keptSeed++;
  } else {
    lastmod[url] = today;
    stamped++;
  }
}

writeFileSync(join(dist, 'lastmod.json'), JSON.stringify(lastmod));
writeFileSync(join(dist, 'content-hash.json'), JSON.stringify(hashes));

let tagged = 0;
for (const name of readdirSync(dist).filter((entry) => /^sitemap-\d+\.xml$/.test(entry))) {
  const file = join(dist, name);
  const xml = readFileSync(file, 'utf8').replace(/<loc>([^<]+)<\/loc>(?:<lastmod>[^<]*<\/lastmod>)?/g, (match, loc) => {
    const date = lastmod[loc];
    if (!date) {
      unknown++;
      return match;
    }
    tagged++;
    return `<loc>${loc}</loc><lastmod>${date}</lastmod>`;
  });
  writeFileSync(file, xml);
}

const dates = Object.values(lastmod);
const uniqueDates = new Set(dates);
console.log(
  `sitemap lastmod: ${tagged} URLs tagged, ${keptLive} kept from live, ${keptSeed} kept from seed, ${stamped} set to ${today}, ${unknown} sitemap URLs without a content hash, ${uniqueDates.size} distinct dates`,
);
if (tagged === 0) process.exit(1);
if (dates.length > 20 && uniqueDates.size < 3) {
  console.error('sitemap lastmod: almost every URL shares one date, which means freshness is still manufactured');
  process.exit(1);
}
