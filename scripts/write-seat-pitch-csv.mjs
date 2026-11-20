// Rewrites public/data/seat-pitch-and-width.csv from src/data/seat-pitch.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import rows from '../src/data/seat-pitch.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public/data/seat-pitch-and-width.csv');

function cell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

const header = ['airline', 'aircraft', 'cabin', 'pitch', 'width', 'source_url', 'date_checked'];
const lines = [
  header.join(','),
  ...rows.map((row) =>
    [row.airline, row.aircraft, row.cabin, row.pitch, row.width, row.sourceUrl, row.dateChecked]
      .map(cell)
      .join(','),
  ),
];
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, `${lines.join('\n')}\n`);
console.log(`seat pitch csv: ${rows.length} rows`);
