/**
 * Build guard for seat map leaf pages.
 * Fails when a document title is duplicated, or when a leaf title, description,
 * h1, SVG title, or any other leaf text contains an em dash or an en dash.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distAirlines = fileURLToPath(new URL('../dist/airlines/', import.meta.url));
const DASH = /[–—]/;

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

async function leafFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await leafFiles(path)));
    else if (path.endsWith(join('seat-map', 'index.html'))) files.push(path);
  }
  return files;
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

const files = await leafFiles(distAirlines);
if (files.length === 0) {
  console.error('No leaf seat map pages found under dist/airlines.');
  process.exit(1);
}

const titles = new Map();
const failures = [];

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const decoded = decode(html);
  const titleTags = [...decoded.matchAll(/<title>([^<]*)<\/title>/g)].map((match) => match[1].trim());
  const documentTitle = titleTags[0];
  const svgTitle = titleTags[1];
  const description = metaContent(html, 'description');
  const h1Match = decoded.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';

  if (!documentTitle) failures.push(`${file}: missing document title`);
  if (!description) failures.push(`${file}: missing meta description`);
  if (!h1) failures.push(`${file}: missing h1`);
  if (!svgTitle) failures.push(`${file}: missing SVG title`);

  for (const [label, value] of [
    ['title', documentTitle],
    ['description', description],
    ['h1', h1],
    ['SVG title', svgTitle],
  ]) {
    if (value && DASH.test(value)) failures.push(`${file}: ${label} contains an em or en dash: ${value}`);
  }

  if (DASH.test(decoded)) {
    const at = decoded.search(DASH);
    failures.push(`${file}: leaf HTML contains an em or en dash near: ${decoded.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' ')}`);
  }

  if (documentTitle) {
    const previous = titles.get(documentTitle);
    if (previous) failures.push(`Duplicate leaf title "${documentTitle}"\n  ${previous}\n  ${file}`);
    else titles.set(documentTitle, file);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Checked ${files.length} leaf seat map pages. Titles are unique and free of em and en dashes.`);
