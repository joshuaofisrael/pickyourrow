// Fails the build if the downloadable CSV drifts from src/data/seat-pitch.json.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import rows from '../src/data/seat-pitch.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const csv = readFileSync(join(root, 'public/data/seat-pitch-and-width.csv'), 'utf8').trim().split('\n');
const expected = rows.length + 1;
if (csv.length !== expected) {
  console.error(`seat pitch csv has ${csv.length} lines, expected ${expected}`);
  process.exit(1);
}
const body = csv.slice(1).map((line) => line.split(',').slice(0, 5).join(','));
rows.forEach((row, index) => {
  const want = [row.airline, row.aircraft, row.cabin, row.pitch, row.width].join(',');
  if (body[index] !== want) {
    console.error(`seat pitch csv row ${index + 1} does not match the JSON`);
    console.error(body[index]);
    console.error(want);
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dateChecked) || row.dateChecked > '2026-11-21') {
    console.error(`seat pitch row ${index + 1} has a missing or future date checked`);
    process.exit(1);
  }
});
console.log(`seat pitch csv: ${rows.length} rows match`);
