/**
 * Build guard for aircraft type hub pages.
 * Fails when a document title is duplicated, or when a type hub title,
 * description, or h1 contains an em dash, an en dash, or a spaced hyphen.
 * Model codes such as 787-9 stay, because the hyphen is not spaced.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distAircraft = fileURLToPath(new URL('../dist/aircraft/', import.meta.url));
const DASH = /[–—]/;
const SPACED_HYPHEN = /\s-\s/;

function decode(value) {
  return value
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '\u2014')
    .replace(/&ndash;|&#8211;|&#x2013;/gi, '\u2013')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\bname="([^"]*)"/i);
    const contentMatch = tag.match(/\bcontent="([^"]*)"/i);
    if (nameMatch && contentMatch && nameMatch[1] === name) return decode(contentMatch[1]);
  }
  return null;
}

const entries = await readdir(distAircraft, { withFileTypes: true });
const files = [];
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  files.push(join(distAircraft, entry.name, 'index.html'));
}

if (files.length === 0) {
  console.error('No aircraft type hub pages found under dist/aircraft.');
  process.exit(1);
}

const titles = new Map();
const failures = [];

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const decoded = decode(html);
  const titleMatch = decoded.match(/<title>([^<]*)<\/title>/);
  const documentTitle = titleMatch ? titleMatch[1].trim() : '';
  const description = metaContent(html, 'description');
  const h1Match = decoded.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';

  if (!documentTitle) failures.push(`${file}: missing document title`);
  if (!description) failures.push(`${file}: missing meta description`);
  if (!h1) failures.push(`${file}: missing h1`);
  if (documentTitle && !documentTitle.includes('seat map')) {
    failures.push(`${file}: title does not mention a seat map: ${documentTitle}`);
  }
  if (h1 && (!h1.includes('seat map') || !h1.includes('seating plan'))) {
    failures.push(`${file}: h1 is missing seat map or seating plan: ${h1}`);
  }
  if (!decoded.includes('type-compare')) failures.push(`${file}: missing comparison table`);

  for (const [label, value] of [
    ['title', documentTitle],
    ['description', description],
    ['h1', h1],
  ]) {
    if (!value) continue;
    if (DASH.test(value)) failures.push(`${file}: ${label} contains an em or en dash: ${value}`);
    if (SPACED_HYPHEN.test(value)) failures.push(`${file}: ${label} contains a spaced hyphen: ${value}`);
  }

  if (DASH.test(decoded)) {
    const at = decoded.search(DASH);
    failures.push(
      `${file}: type hub HTML contains an em or en dash near: ${decoded.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' ')}`,
    );
  }

  if (documentTitle) {
    const previous = titles.get(documentTitle);
    if (previous) failures.push(`Duplicate type hub title "${documentTitle}"\n  ${previous}\n  ${file}`);
    else titles.set(documentTitle, file);
  }
}

const directoryPath = join(distAircraft, 'index.html');
const directoryHtml = decode(await readFile(directoryPath, 'utf8'));
const directoryTitle = directoryHtml.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? '';
const directoryDescription = metaContent(directoryHtml, 'description');
if (!directoryTitle.includes('seat map')) {
  failures.push(`${directoryPath}: directory title does not mention a seat map: ${directoryTitle}`);
}
for (const [label, value] of [
  ['title', directoryTitle],
  ['description', directoryDescription],
]) {
  if (value && DASH.test(value)) failures.push(`${directoryPath}: ${label} contains an em or en dash: ${value}`);
  if (value && SPACED_HYPHEN.test(value)) failures.push(`${directoryPath}: ${label} contains a spaced hyphen: ${value}`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Checked ${files.length} aircraft type hubs. Titles are unique and free of em dashes, en dashes, and spaced hyphens.`);
