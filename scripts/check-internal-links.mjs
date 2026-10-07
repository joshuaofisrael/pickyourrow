/**
 * Build guard for internal links.
 * Fails when a href in dist does not resolve to a built file, when a leaf seat
 * map is missing its type hub, sibling aircraft, or same type peers, when a
 * best seats page is missing its seat map or type hub, or when an aircraft
 * type hub comparison row is missing that airline's leaf seat map.
 *
 * Peer selection must stay aligned with src/lib/relatedSeatMaps.ts.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const distRoot = normalize(dist);
const PEER_SEAT_MAP_LIMIT = 6;
const SITE = 'https://pickyourrow.com';

const airlines = JSON.parse(readFileSync(new URL('../src/data/airlines.json', import.meta.url), 'utf8'));
const configs = JSON.parse(readFileSync(new URL('../src/data/aircraft.json', import.meta.url), 'utf8'));

function decode(value) {
  return value
    .replace(/&amp;|&#38;|&#x26;/gi, '&')
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;|&#60;/gi, '<')
    .replace(/&gt;|&#62;/gi, '>')
    .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function aircraftTypeSlug(aircraftType) {
  return aircraftType
    .toLowerCase()
    .replace(/boeing\s+/i, '')
    .replace(/airbus\s+/i, '')
    .replace(/\s+/g, '-');
}

function shortAircraftType(aircraftType) {
  return aircraftType.replace(/^(?:Boeing|Airbus)\s+/i, '');
}

function seatMapPath(config) {
  const param = config.slug.replace(new RegExp(`^${config.airlineSlug}-`), '');
  return `/airlines/${config.airlineSlug}/${param}/seat-map/`;
}

function typeHubPath(config) {
  return `/aircraft/${aircraftTypeSlug(config.aircraftType)}/`;
}

function typeHubAnchor(aircraftType) {
  return `All ${aircraftType} seat maps by airline`;
}

function seatMapAnchor(airlineName, aircraftType) {
  return `${airlineName} ${shortAircraftType(aircraftType)} seat map`;
}

function airlineBySlug(slug) {
  const airline = airlines.find((item) => item.slug === slug);
  if (!airline) throw new Error(`Missing airline for ${slug}`);
  return airline;
}

function byName(left, right) {
  return left.localeCompare(right, 'en', { sensitivity: 'base' });
}

function toLink(airline, config) {
  return {
    href: seatMapPath(config),
    label: seatMapAnchor(airline.name, config.aircraftType),
  };
}

function siblingSeatMaps(config) {
  return configs
    .filter((item) => item.airlineSlug === config.airlineSlug && item.slug !== config.slug)
    .map((item) => toLink(airlineBySlug(item.airlineSlug), item))
    .sort((a, b) => byName(a.label, b.label) || a.href.localeCompare(b.href));
}

function peerSeatMaps(config, limit = PEER_SEAT_MAP_LIMIT) {
  const type = aircraftTypeSlug(config.aircraftType);
  const sameType = configs
    .filter((item) => aircraftTypeSlug(item.aircraftType) === type)
    .map((item) => ({ item, airline: airlineBySlug(item.airlineSlug) }))
    .sort((a, b) => byName(a.airline.name, b.airline.name) || a.item.slug.localeCompare(b.item.slug));

  const others = sameType.filter((entry) => entry.item.slug !== config.slug);
  if (others.length <= limit) return others.map((entry) => toLink(entry.airline, entry.item));

  const index = sameType.findIndex((entry) => entry.item.slug === config.slug);
  if (index < 0) throw new Error(`Config missing from type group: ${config.slug}`);

  const picked = [];
  for (let step = 1; picked.length < limit && step < sameType.length; step++) {
    const entry = sameType[(index + step) % sameType.length];
    if (entry.item.slug === config.slug) continue;
    picked.push(toLink(entry.airline, entry.item));
  }
  return picked;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

function insideDist(candidate) {
  const norm = normalize(candidate);
  return norm === distRoot || norm.startsWith(distRoot.endsWith(sep) ? distRoot : `${distRoot}${sep}`);
}

function fileForPath(pathname) {
  let rel = pathname;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (rel.includes('\0') || rel.split('/').includes('..')) return null;
  const relative = rel.replace(/^\/+/, '');
  const candidates = [];
  if (relative === '') candidates.push(join(dist, 'index.html'));
  else {
    const base = join(dist, relative);
    candidates.push(base);
    if (relative.endsWith('/')) candidates.push(join(base, 'index.html'));
    else {
      candidates.push(`${base}.html`);
      candidates.push(join(base, 'index.html'));
    }
  }
  for (const candidate of candidates) {
    if (!insideDist(candidate)) continue;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function pathnameOf(href) {
  const decoded = decode(href.trim());
  if (
    !decoded ||
    decoded.startsWith('#') ||
    decoded.startsWith('mailto:') ||
    decoded.startsWith('tel:') ||
    decoded.startsWith('javascript:')
  ) {
    return null;
  }
  let url;
  try {
    url = new URL(decoded, `${SITE}/`);
  } catch {
    return { error: `unparseable href ${href}` };
  }
  if (url.origin !== SITE) return null;
  return url.pathname;
}

function anchors(html) {
  const out = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const hrefMatch = match[1].match(/\bhref\s*=\s*"([^"]*)"/i) || match[1].match(/\bhref\s*=\s*'([^']*)'/i);
    if (!hrefMatch) continue;
    const text = decode(match[2].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    out.push({ href: decode(hrefMatch[1]), text });
  }
  return out;
}

function allHrefs(html) {
  const out = [];
  for (const match of html.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    out.push(decode(match[1] ?? match[2]));
  }
  return out;
}

function readPage(pathname) {
  const file = fileForPath(pathname);
  if (!file) return null;
  return { file, html: readFileSync(file, 'utf8') };
}

function sameSet(actual, expected) {
  if (actual.length !== expected.length) return false;
  const pending = [...expected];
  for (const value of actual) {
    const index = pending.indexOf(value);
    if (index < 0) return false;
    pending.splice(index, 1);
  }
  return pending.length === 0;
}

function forbiddenDash(text) {
  return /[–—]/.test(text) || /\s-\s/.test(text);
}

const failures = [];

const htmlFiles = walk(dist);
if (htmlFiles.length === 0) {
  console.error('No HTML files found under dist.');
  process.exit(1);
}

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const href of allHrefs(html)) {
    const path = pathnameOf(href);
    if (!path) continue;
    if (typeof path === 'object') {
      failures.push(`${file}: ${path.error}`);
      continue;
    }
    if (!fileForPath(path)) failures.push(`${file}: internal href does not resolve: ${href} -> ${path}`);
  }
}

for (const config of configs) {
  const airline = airlineBySlug(config.airlineSlug);
  const seatMap = seatMapPath(config);
  const typeHub = typeHubPath(config);
  const siblings = siblingSeatMaps(config);
  const peers = peerSeatMaps(config);
  const page = readPage(seatMap);
  if (!page) {
    failures.push(`Missing leaf page ${seatMap}`);
    continue;
  }

  const crumbMatch = page.html.match(/<nav class="breadcrumb">([\s\S]*?)<\/nav>/);
  if (!crumbMatch || !crumbMatch[1].includes(`href="${typeHub}"`)) {
    failures.push(`${seatMap}: breadcrumb is missing the aircraft type hub`);
  }

  const sectionMatch = page.html.match(/<section[^>]*class="related-maps"[\s\S]*?<\/section>/);
  if (!sectionMatch) {
    failures.push(`${seatMap}: missing related seat maps section`);
    continue;
  }
  const sectionText = decode(sectionMatch[0].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  if (forbiddenDash(sectionText)) {
    failures.push(`${seatMap}: related seat maps copy contains a forbidden dash`);
  }

  const sectionAnchors = anchors(sectionMatch[0]);
  const sectionHrefs = sectionAnchors.map((anchor) => pathnameOf(anchor.href)).filter((href) => typeof href === 'string');
  if (!sectionHrefs.includes(typeHub)) failures.push(`${seatMap}: related section is missing ${typeHub}`);
  const typeLabel = sectionAnchors.find((anchor) => pathnameOf(anchor.href) === typeHub);
  if (!typeLabel || typeLabel.text !== typeHubAnchor(config.aircraftType)) {
    failures.push(`${seatMap}: type hub anchor is missing or not descriptive`);
  }

  for (const link of [...siblings, ...peers]) {
    const found = sectionAnchors.find((anchor) => pathnameOf(anchor.href) === link.href);
    if (!found) failures.push(`${seatMap}: related section is missing ${link.href}`);
    else if (found.text !== link.label) {
      failures.push(`${seatMap}: anchor for ${link.href} is "${found.text}", expected "${link.label}"`);
    }
    if (forbiddenDash(link.label)) failures.push(`${seatMap}: forbidden dash in anchor ${link.label}`);
  }

  const pageSeatMaps = anchors(page.html)
    .map((anchor) => pathnameOf(anchor.href))
    .filter((href) => typeof href === 'string' && /\/airlines\/[^/]+\/[^/]+\/seat-map\/$/.test(href));
  const expectedSeatMaps = [...siblings, ...peers].map((link) => link.href);
  if (!sameSet(pageSeatMaps, expectedSeatMaps)) {
    failures.push(
      `${seatMap}: seat map links ${pageSeatMaps.join(', ') || '(none)'} != ${expectedSeatMaps.join(', ') || '(none)'}`,
    );
  }

  let breadcrumbUrls = [];
  for (const match of page.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const parsed = JSON.parse(match[1]);
    const blocks = Array.isArray(parsed) ? parsed : [parsed];
    for (const block of blocks) {
      if (block['@type'] !== 'BreadcrumbList') continue;
      breadcrumbUrls = block.itemListElement.map((item) => item.item);
      const typeItem = block.itemListElement.find((item) => item.item === `${SITE}${typeHub}`);
      if (!typeItem) failures.push(`${seatMap}: BreadcrumbList is missing ${typeHub}`);
      else if (typeItem.name !== config.aircraftType) {
        failures.push(`${seatMap}: BreadcrumbList type name is "${typeItem.name}"`);
      }
      const self = block.itemListElement.find((item) => item.item === `${SITE}${seatMap}`);
      if (!self) failures.push(`${seatMap}: BreadcrumbList is missing the leaf url`);
    }
  }
  if (!breadcrumbUrls.includes(`${SITE}${typeHub}`)) {
    failures.push(`${seatMap}: JSON-LD does not list the aircraft type hub`);
  }

  const bestPath = seatMap.replace('/airlines/', '/best-seats/').replace(/\/seat-map\/$/, '/');
  const best = readPage(bestPath);
  if (!best) {
    failures.push(`Missing best seats page ${bestPath}`);
    continue;
  }
  const bestAnchors = anchors(best.html);
  const seatAnchor = bestAnchors.find(
    (anchor) => pathnameOf(anchor.href) === seatMap && anchor.text === seatMapAnchor(airline.name, config.aircraftType),
  );
  const hubAnchor = bestAnchors.find(
    (anchor) => pathnameOf(anchor.href) === typeHub && anchor.text === typeHubAnchor(config.aircraftType),
  );
  if (!seatAnchor) failures.push(`${bestPath}: missing descriptive link to ${seatMap}`);
  if (!hubAnchor) failures.push(`${bestPath}: missing descriptive link to ${typeHub}`);
  if (seatAnchor && forbiddenDash(seatAnchor.text)) failures.push(`${bestPath}: forbidden dash in seat map anchor`);
  if (hubAnchor && forbiddenDash(hubAnchor.text)) failures.push(`${bestPath}: forbidden dash in type hub anchor`);
}

const groups = new Map();
for (const config of configs) {
  const slug = aircraftTypeSlug(config.aircraftType);
  const group = groups.get(slug) ?? [];
  group.push(config);
  groups.set(slug, group);
}

for (const [slug, group] of groups) {
  const hubPath = `/aircraft/${slug}/`;
  const page = readPage(hubPath);
  if (!page) {
    failures.push(`Missing aircraft type hub ${hubPath}`);
    continue;
  }
  const tableMatch = page.html.match(/<table class="fleet type-compare"[\s\S]*?<\/table>/);
  if (!tableMatch) {
    failures.push(`${hubPath}: missing comparison table`);
    continue;
  }
  const rows = [...tableMatch[0].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].slice(1);
  const rowMaps = rows.map((row) =>
    anchors(row[1])
      .map((anchor) => pathnameOf(anchor.href))
      .filter((href) => typeof href === 'string' && href.endsWith('/seat-map/')),
  );
  if (rowMaps.length !== group.length) {
    failures.push(`${hubPath}: comparison table has ${rowMaps.length} rows, expected ${group.length}`);
  }
  if (rowMaps.some((links) => links.length !== 1)) {
    failures.push(`${hubPath}: a comparison row is missing its leaf seat map link`);
  }
  const actual = rowMaps.map((links) => links[0]).filter(Boolean);
  const expected = group.map((config) => seatMapPath(config));
  if (!sameSet(actual, expected)) {
    failures.push(`${hubPath}: comparison seat map links do not match the configs for this type`);
  }
}

const sitemapIndex = readFileSync(join(dist, 'sitemap-index.xml'), 'utf8');
const sitemap = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
if (!sitemapIndex.includes('sitemap-0.xml')) failures.push('sitemap-index.xml does not reference sitemap-0.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => decode(match[1]));
for (const config of configs) {
  const loc = `${SITE}${seatMapPath(config)}`;
  if (!locs.includes(loc)) failures.push(`Sitemap is missing ${loc}`);
}

if (failures.length > 0) {
  console.error(failures.slice(0, 40).join('\n'));
  if (failures.length > 40) console.error(`... and ${failures.length - 40} more`);
  process.exit(1);
}

console.log(
  `Checked internal links across ${htmlFiles.length} HTML files, ${configs.length} leaf seat maps, and ${groups.size} aircraft type hubs.`,
);
