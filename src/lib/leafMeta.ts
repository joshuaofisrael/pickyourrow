import type { Airline, AircraftConfig } from '../data/types';
import { layoutString } from '../data';
import { topSeats } from './scoring';

/** Title text before the site suffix. Google shows roughly this many characters. */
const TITLE_LIMIT = 60;
const DESC_MIN = 140;
const DESC_MAX = 160;

const HONESTY = 'Original illustrative schematic. Configs vary. Not affiliated.';

/** Manufacturer words are not part of how people search a type ("A319", "787-9"). */
export function shortAircraftType(aircraftType: string): string {
  return aircraftType.replace(/^(?:Boeing|Airbus)\s+/i, '');
}

/**
 * Prose dashes become commas, or "to" inside a numeric range.
 * Model codes (737-800) and layouts (3-3) have no spaces, so they stay.
 */
export function softenProseDashes(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
    .replace(/\s*[–—]\s*/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/^,\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function listAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function leafHeading(airline: Airline, config: AircraftConfig): string {
  return `${airline.name} ${config.aircraftType} seat map`;
}

export function leafTitle(airline: Airline, config: AircraftConfig): string {
  const type = shortAircraftType(config.aircraftType);
  const withAnd = `${airline.name} ${type} seat map and seating plan`;
  const withComma = `${airline.name} ${type} seat map, seating plan`;
  const seatMapOnly = `${airline.name} ${type} seat map`;
  const lead =
    withAnd.length <= TITLE_LIMIT ? withAnd : withComma.length <= TITLE_LIMIT ? withComma : seatMapOnly;

  const hooks = [`${config.totalSeatsApprox} seats`, `layout ${layoutString(config)}`];
  for (const hook of hooks) {
    const candidate = `${lead}, ${hook}`;
    if (candidate.length <= TITLE_LIMIT) return candidate;
  }
  return lead;
}

function cabinSentences(config: AircraftConfig): string[] {
  const labels = config.cabins.map((cabin) => cabin.label);
  const count = labels.length === 1 ? '1 cabin.' : `${labels.length} cabins.`;
  if (labels.length === 1) return [count, `Cabin: ${labels[0]}.`];
  if (labels.length === 2) return [count, `Cabins: ${labels[0]} and ${labels[1]}.`];
  return [count, `Cabins: ${listAnd(labels)}.`];
}

function pickSentences(config: AircraftConfig): string[] {
  const ids = topSeats(config, 3).map((seat) => seat.seatId);
  const sentences: string[] = [];
  if (ids.length >= 3) sentences.push(`Editorial picks ${ids[0]}, ${ids[1]}, and ${ids[2]}.`);
  if (ids.length >= 2) sentences.push(`Editorial picks ${ids[0]} and ${ids[1]}.`);
  if (ids.length >= 1) sentences.push(`Editorial pick ${ids[0]}.`);
  return sentences;
}

function exitSentences(exitRows: number[]): string[] {
  if (exitRows.length === 0) return [];
  if (exitRows.length === 1) return [`Exit row ${exitRows[0]}.`];
  return [`Exit rows ${listAnd(exitRows.map(String))}.`];
}

/** Higher tuples win. Editorial picks come first, then honesty and cabin detail. */
function descriptionRank(text: string, typical: boolean): number[] {
  const namedCabins = text.includes('Cabin:') || text.includes('Cabins:');
  return [
    text.includes('Editorial pick') ? 1 : 0,
    typical ? 1 : 0,
    namedCabins ? 1 : 0,
    text.includes('Editorial picks') ? 1 : 0,
    /\d+ cabins?\./.test(text) ? 1 : 0,
    text.includes('Exit row') ? 1 : 0,
    -Math.abs(text.length - 152),
  ];
}

function rankBetter(left: number[], right: number[]): boolean {
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] > right[i];
  }
  return false;
}

export function leafDescription(airline: Airline, config: AircraftConfig): string {
  const type = shortAircraftType(config.aircraftType);
  const layout = layoutString(config);
  const seats = config.totalSeatsApprox;
  const bases: { text: string; typical: boolean }[] = [
    {
      text: `Typical ${airline.name} ${type} seating chart, about ${seats} seats, layout ${layout}.`,
      typical: true,
    },
    {
      text: `${airline.name} ${type} seating chart, about ${seats} seats, layout ${layout}.`,
      typical: false,
    },
  ];
  const groups = [cabinSentences(config), pickSentences(config), exitSentences(config.exitRows)];

  let best: string | null = null;
  let bestRank: number[] | null = null;

  for (const base of bases) {
    const choices: string[][] = [[]];
    for (const group of groups) {
      const next: string[][] = [];
      for (const choice of choices) {
        next.push(choice);
        for (const sentence of group) next.push([...choice, sentence]);
      }
      choices.splice(0, choices.length, ...next);
    }
    for (const extra of choices) {
      const text = [base.text, ...extra, HONESTY].join(' ');
      if (text.length < DESC_MIN || text.length > DESC_MAX) continue;
      const rank = descriptionRank(text, base.typical);
      if (!bestRank || rankBetter(rank, bestRank)) {
        best = text;
        bestRank = rank;
      }
    }
  }

  if (!best) {
    throw new Error(`No 140 to 160 character description for ${config.slug}`);
  }
  return best;
}

export function assertLeafMeta(airlines: Airline[], configs: AircraftConfig[]): void {
  const seen = new Map<string, string>();
  for (const config of configs) {
    const airline = airlines.find((item) => item.slug === config.airlineSlug);
    if (!airline) throw new Error(`Missing airline for ${config.slug}`);
    const title = leafTitle(airline, config);
    const description = leafDescription(airline, config);
    if (/[–—]/.test(title) || /[–—]/.test(description)) {
      throw new Error(`Leaf title or description contains an em or en dash (${config.slug})`);
    }
    if (title.length > TITLE_LIMIT) {
      throw new Error(`Leaf title is ${title.length} characters (${config.slug}): ${title}`);
    }
    if (description.length < DESC_MIN || description.length > DESC_MAX) {
      throw new Error(`Leaf description is ${description.length} characters (${config.slug}): ${description}`);
    }
    const previous = seen.get(title);
    if (previous) {
      throw new Error(`Duplicate leaf title "${title}" on ${config.slug} and ${previous}`);
    }
    seen.set(title, config.slug);
  }
}
