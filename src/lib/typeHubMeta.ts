import type { Airline, AircraftConfig, CabinSection } from '../data/types';
import { layoutString } from '../data';
import { shortAircraftType } from './leafMeta';

/** Title text before the site suffix. Same limit as leaf seat map titles. */
const TITLE_LIMIT = 60;
const DESC_MIN = 140;
const DESC_MAX = 160;

export interface TypeHubEntry {
  typeSlug: string;
  label: string;
  configs: AircraftConfig[];
}

/** Drawn seats in one cabin: present rows times seat letters. Missing rows are skipped. */
export function cabinSeatCount(cabin: CabinSection): number {
  const missing = new Set(
    (cabin.missingRows ?? []).filter((row) => row >= cabin.startRow && row <= cabin.endRow),
  );
  let rows = 0;
  for (let row = cabin.startRow; row <= cabin.endRow; row++) {
    if (!missing.has(row)) rows++;
  }
  const perRow = cabin.layout.reduce((sum, block) => sum + block.letters.length, 0);
  return rows * perRow;
}

/** Cabin labels and drawn seat counts, in nose to tail order. */
export function cabinCountPhrase(config: AircraftConfig): string {
  return config.cabins.map((cabin) => `${cabin.label} ${cabinSeatCount(cabin)}`).join(', ');
}

export function exitRowPhrase(config: AircraftConfig): string {
  if (config.exitRows.length === 0) return 'None marked';
  return config.exitRows.join(', ');
}

function seatBounds(entry: TypeHubEntry): { min: number; max: number } {
  const seats = entry.configs.map((config) => config.totalSeatsApprox);
  return { min: Math.min(...seats), max: Math.max(...seats) };
}

function seatPhrase(entry: TypeHubEntry): string {
  const { min, max } = seatBounds(entry);
  return min === max ? `about ${min} seats` : `about ${min} to ${max} seats`;
}

function listAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function rankBetter(left: number[], right: number[]): boolean {
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] > right[i];
  }
  return false;
}

export function typeHubTitle(entry: TypeHubEntry): string {
  const count = entry.configs.length;
  const { min, max } = seatBounds(entry);
  const short = shortAircraftType(entry.label);
  const mapWord = count === 1 ? 'seat map' : 'seat maps';
  const layouts = count === 1 ? '1 airline layout' : `${count} airline layouts`;
  const seats = min === max ? `${min} seats` : `${min} to ${max} seats`;
  const withAnd = `${short} ${mapWord} and seating plan`;
  const withComma = `${short} ${mapWord}, seating plan`;
  const mapOnly = `${short} ${mapWord}`;
  const lead = withAnd.length <= TITLE_LIMIT ? withAnd : withComma.length <= TITLE_LIMIT ? withComma : mapOnly;

  for (const hook of [`${layouts}, ${seats}`, layouts, seats]) {
    const candidate = `${lead}, ${hook}`;
    if (candidate.length <= TITLE_LIMIT) return candidate;
  }
  return lead;
}

export function typeHubDescription(entry: TypeHubEntry): string {
  const count = entry.configs.length;
  const mapWord = count === 1 ? 'seat map' : 'seat maps';
  const layoutWord = count === 1 ? '1 airline layout' : `${count} airline layouts`;
  const seats = seatPhrase(entry);
  const bases = [
    `Illustrative ${entry.label} ${mapWord} for ${layoutWord}, ${seats}.`,
    `${entry.label} ${mapWord} for ${layoutWord}, ${seats}.`,
  ];
  const mids =
    count === 1
      ? [
          'See the economy seat layout and the seating chart.',
          'The table lists the economy seat layout and the seating chart.',
          'Check the seat layout, then open the seating chart.',
        ]
      : [
          'Compare economy seat layout, then open a seating chart.',
          'The table compares seat layout and links each seating chart.',
          'Use the table for seat layout, then open a seating chart.',
        ];
  const tails = [
    count === 1
      ? 'Original illustrative schematic. Configs vary. Not affiliated.'
      : 'Original illustrative schematics. Configs vary. Not affiliated.',
    count === 1
      ? 'Original schematic. Configs vary. Not affiliated.'
      : 'Original schematics. Configs vary. Not affiliated.',
    'Configs vary. Not affiliated.',
    count === 1 ? 'Original schematic. Configs vary.' : 'Original schematics. Configs vary.',
  ];

  let best: string | null = null;
  let bestRank: number[] | null = null;
  for (const base of bases) {
    for (const mid of mids) {
      for (const tail of tails) {
        const text = `${base} ${mid} ${tail}`;
        if (text.length < DESC_MIN || text.length > DESC_MAX) continue;
        if (!text.includes('seat layout') && !text.includes('seating chart')) continue;
        const rank = [
          text.startsWith('Illustrative') ? 1 : 0,
          text.includes('Original') ? 1 : 0,
          text.includes('Not affiliated') ? 1 : 0,
          text.includes('seat layout') && text.includes('seating chart') ? 1 : 0,
          -Math.abs(text.length - 152),
        ];
        if (!bestRank || rankBetter(rank, bestRank)) {
          best = text;
          bestRank = rank;
        }
      }
    }
  }

  if (!best) {
    throw new Error(`No ${DESC_MIN} to ${DESC_MAX} character description for ${entry.typeSlug}`);
  }
  return best;
}

export function typeHubHeading(entry: TypeHubEntry): string {
  const mapWord = entry.configs.length === 1 ? 'seat map' : 'seat maps';
  return `${entry.label} ${mapWord} and seating plan`;
}

export function typeHubIntro(entry: TypeHubEntry): string {
  const count = entry.configs.length;
  const seats = seatPhrase(entry);
  if (count === 1) {
    return `This ${entry.label} seat map shows 1 airline layout, ${seats}. Open the table for that seating plan. The drawing is an original illustrative schematic.`;
  }
  return `These ${entry.label} seat maps compare ${count} airline layouts, ${seats}. Match your carrier in the table, then open that seating plan. Drawings are original illustrative schematics.`;
}

export function typeHubCaption(entry: TypeHubEntry): string {
  return `${entry.label} seat maps compared`;
}

/** Which drawn configs carry the most and fewest approximate seats. */
export function typeHubAnalysis(entry: TypeHubEntry, airlines: Airline[]): string {
  const nameBySlug = new Map(airlines.map((airline) => [airline.slug, airline.name]));
  const rows = entry.configs.map((config) => {
    const name = nameBySlug.get(config.airlineSlug);
    if (!name) throw new Error(`Missing airline for ${config.slug}`);
    return { name, seats: config.totalSeatsApprox };
  });
  const { min, max } = seatBounds(entry);
  if (rows.length === 1) {
    return `${rows[0].name} is the only ${entry.label} layout drawn here, with about ${min} seats.`;
  }
  if (min === max) {
    return `All ${rows.length} ${entry.label} layouts drawn here use about ${min} seats.`;
  }
  const namesAt = (target: number) =>
    [...new Set(rows.filter((row) => row.seats === target).map((row) => row.name))].sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' }),
    );
  const most = namesAt(max);
  const fewest = namesAt(min);
  const verb = (count: number) => (count === 1 ? 'packs' : 'pack');
  return `${listAnd(most)} ${verb(most.length)} the most seats on this ${entry.label}, about ${max}. ${listAnd(fewest)} ${verb(fewest.length)} the fewest, about ${min}.`;
}

/** Explains the two seat figures. Pitch and width are not stored, so they are not compared. */
export const CABIN_COUNT_NOTE =
  'Cabin counts are seats drawn in each section: every present row times its seat letters, skipping missing rows. The approximate total is the planning figure stored on the config, so the two numbers can differ.';

export const AIRCRAFT_DIRECTORY_TITLE = 'Aircraft seat maps and seating plans by type';

export function aircraftDirectoryDescription(typeCount: number): string {
  return `Compare original seat maps for ${typeCount} aircraft types. Each page lists airline layouts, approximate seats, and economy seat layout, then links a seating chart.`;
}

function assertNoDash(kind: string, raw: string, allowed: string[]) {
  let stripped = raw;
  const labels = [...new Set(allowed.filter((label) => label.length > 0))].sort((a, b) => b.length - a.length);
  for (const label of labels) stripped = stripped.split(label).join('');
  if (/[–—]/.test(stripped) || /\s-\s/.test(stripped) || /-/.test(stripped)) {
    throw new Error(`${kind} contains a dash outside allowed labels: ${stripped}`);
  }
}

export function assertTypeHubMeta(entries: TypeHubEntry[], airlines: Airline[]): void {
  const seenTitles = new Map<string, string>();
  const seenDescriptions = new Map<string, string>();
  const airlineNames = airlines.map((airline) => airline.name);

  assertNoDash('Cabin count note', CABIN_COUNT_NOTE, []);

  for (const entry of entries) {
    if (entry.configs.length === 0) throw new Error(`Type hub has no configs: ${entry.typeSlug}`);
    const title = typeHubTitle(entry);
    const description = typeHubDescription(entry);
    const heading = typeHubHeading(entry);
    const intro = typeHubIntro(entry);
    const analysis = typeHubAnalysis(entry, airlines);
    const caption = typeHubCaption(entry);
    const allowed = [entry.label, shortAircraftType(entry.label), ...airlineNames];

    if (title.length > TITLE_LIMIT) {
      throw new Error(`Type hub title is ${title.length} characters (${entry.typeSlug}): ${title}`);
    }
    if (!title.includes('seat map')) {
      throw new Error(`Type hub title does not mention a seat map (${entry.typeSlug}): ${title}`);
    }
    if (!heading.includes('seat map') || !heading.includes('seating plan')) {
      throw new Error(`Type hub H1 is missing seat map or seating plan (${entry.typeSlug}): ${heading}`);
    }
    if (description.length < DESC_MIN || description.length > DESC_MAX) {
      throw new Error(`Type hub description is ${description.length} characters (${entry.typeSlug}): ${description}`);
    }
    if (!description.includes('seat layout') && !description.includes('seating chart')) {
      throw new Error(`Type hub description lacks seat layout or seating chart (${entry.typeSlug})`);
    }

    const previousTitle = seenTitles.get(title);
    if (previousTitle) throw new Error(`Duplicate type hub title "${title}" on ${entry.typeSlug} and ${previousTitle}`);
    seenTitles.set(title, entry.typeSlug);

    const previousDescription = seenDescriptions.get(description);
    if (previousDescription) {
      throw new Error(`Duplicate type hub description on ${entry.typeSlug} and ${previousDescription}`);
    }
    seenDescriptions.set(description, entry.typeSlug);

    assertNoDash('Page title', title, allowed);
    assertNoDash('Meta description', description, allowed);
    assertNoDash('H1', heading, allowed);
    assertNoDash('Intro', intro, allowed);
    assertNoDash('Analysis', analysis, allowed);
    assertNoDash('Caption', caption, allowed);

    for (const config of entry.configs) {
      cabinCountPhrase(config);
      if (!layoutString(config)) throw new Error(`Missing economy layout for ${config.slug}`);
    }
  }
}

export function assertDirectoryCopy(title: string, description: string): void {
  if (title.length > TITLE_LIMIT) {
    throw new Error(`Aircraft directory title is ${title.length} characters: ${title}`);
  }
  if (description.length < DESC_MIN || description.length > DESC_MAX) {
    throw new Error(`Aircraft directory description is ${description.length} characters: ${description}`);
  }
  assertNoDash('Directory title', title, []);
  assertNoDash('Directory description', description, []);
}
