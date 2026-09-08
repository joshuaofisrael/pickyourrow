import type { AircraftConfig, CabinSection, SeatScore, ScoreTag } from '../data/types';

function lettersInCabin(cabin: CabinSection): string[] {
  return cabin.layout.flatMap((b) => b.letters);
}

function isWindow(letter: string, cabin: CabinSection): boolean {
  const all = lettersInCabin(cabin);
  if (all.length === 0) return false;
  return letter === all[0] || letter === all[all.length - 1];
}

function isAisle(letter: string, cabin: CabinSection): boolean {
  const blocks = cabin.layout;
  if (blocks.length < 2) return false;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (i === 0 && letter === block.letters[block.letters.length - 1]) return true;
    if (i === blocks.length - 1 && letter === block.letters[0]) return true;
    if (i > 0 && i < blocks.length - 1) {
      if (letter === block.letters[0] || letter === block.letters[block.letters.length - 1]) return true;
    }
  }
  return false;
}

function nearFacility(config: AircraftConfig, row: number, type: 'lav' | 'galley'): boolean {
  return config.facilities.some((f) => f.type === type && Math.abs(f.afterRow - row) <= 1);
}

function isBulkheadRow(config: AircraftConfig, row: number, cabin: CabinSection): boolean {
  if (row === cabin.startRow) return true;
  return config.facilities.some((f) => f.type === 'bulkhead' && f.afterRow === row - 1);
}

export function scoreSeats(config: AircraftConfig): SeatScore[] {
  const scores: SeatScore[] = [];

  for (const cabin of config.cabins) {
    const missing = new Set(cabin.missingRows ?? []);
    for (let row = cabin.startRow; row <= cabin.endRow; row++) {
      if (missing.has(row)) continue;
      for (const letter of lettersInCabin(cabin)) {
        const tags: ScoreTag[] = [];
        let score = 6;
        const seatId = `${row}${letter}`;

        const exit = config.exitRows.includes(row);
        const bulk = isBulkheadRow(config, row, cabin);
        const lav = nearFacility(config, row, 'lav');
        const galley = nearFacility(config, row, 'galley');
        const lastRows = row >= cabin.endRow - 1;

        if (exit) {
          tags.push('exit', 'extra-legroom');
          score += 2;
        }
        if (bulk && !exit) {
          tags.push('bulkhead', 'extra-legroom');
          score += 1.5;
        }
        if (isWindow(letter, cabin)) {
          tags.push('window');
          score += 0.5;
        } else if (isAisle(letter, cabin)) {
          tags.push('aisle');
          score += 0.4;
        } else {
          tags.push('middle');
          score -= 1.2;
        }
        if (lav) {
          tags.push('near-lav');
          score -= 1.8;
        }
        if (galley) {
          tags.push('near-galley');
          score -= 1.0;
        }
        if (lastRows) {
          tags.push('rear');
          score -= 0.6;
        }
        if (!lav && !galley && !lastRows && (exit || bulk)) {
          tags.push('quiet');
        }
        if (tags.length === 0) tags.push('standard');

        score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

        let summary = 'Standard seat.';
        if (exit && !lav) summary = 'Exit row — often more legroom; check airline eligibility.';
        else if (bulk && !lav) summary = 'Bulkhead / cabin-front — space ahead; storage may be limited.';
        else if (lav) summary = 'Near lavatory — expect traffic and noise.';
        else if (galley) summary = 'Near galley — service noise possible.';
        else if (tags.includes('middle')) summary = 'Middle seat — fine for groups, less ideal solo.';
        else if (tags.includes('window')) summary = 'Window seat — good for rest and views.';
        else if (tags.includes('aisle')) summary = 'Aisle seat — easy access to walk around.';
        if (lastRows && !lav) summary += ' Toward the rear of this cabin.';

        scores.push({
          seatId,
          row,
          letter,
          cabinClass: cabin.cabinClass,
          score,
          tags,
          summary,
        });
      }
    }
  }

  return scores;
}

export function topSeats(config: AircraftConfig, limit = 8): SeatScore[] {
  return [...scoreSeats(config)]
    .sort((a, b) => b.score - a.score || a.row - b.row || a.letter.localeCompare(b.letter))
    .slice(0, limit);
}

export function cautionSeats(config: AircraftConfig, limit = 6): SeatScore[] {
  return [...scoreSeats(config)]
    .sort((a, b) => a.score - b.score || a.row - b.row)
    .slice(0, limit);
}
