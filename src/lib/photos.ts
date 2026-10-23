export type PhotoKey =
  | 'economy-cabin' | 'business-cabin' | 'first-suite' | 'aircraft-runway'
  | 'airport-gate' | 'window-view' | 'widebody-gate';

export const PHOTOS: Record<PhotoKey, { alt: string; caption: string }> = {
  'economy-cabin': {
    alt: 'Empty airliner economy cabin with rows of grey seats on both sides of the aisle',
    caption: 'AI generated illustration of a typical economy cabin, not a specific aircraft.',
  },
  'business-cabin': {
    alt: 'Airliner business class cabin with lie flat seats under warm evening lighting',
    caption: 'AI generated illustration of a typical business class cabin, not a specific aircraft.',
  },
  'first-suite': {
    alt: 'Private first class suite with a cream leather seat, side table and window',
    caption: 'AI generated illustration of a typical first class suite, not a specific aircraft.',
  },
  'aircraft-runway': {
    alt: 'White narrowbody airliner lifting off a runway at golden hour',
    caption: 'AI generated illustration of a typical narrowbody airliner, not a specific aircraft or airline.',
  },
  'airport-gate': {
    alt: 'Empty airport gate seating with a parked airliner visible through the windows at dusk',
    caption: 'AI generated illustration of an airport gate, not a specific airport.',
  },
  'window-view': {
    alt: 'View of an airliner wing above clouds at sunrise through a cabin window',
    caption: 'AI generated illustration of a window seat view, not a specific flight.',
  },
  'widebody-gate': {
    alt: 'White widebody airliner parked at a gate with a jet bridge on a misty morning',
    caption: 'AI generated illustration of a typical widebody airliner, not a specific aircraft or airline.',
  },
};

const CABIN: PhotoKey[] = ['economy-cabin', 'business-cabin', 'first-suite', 'window-view'];
const EXTERIOR: PhotoKey[] = ['aircraft-runway', 'widebody-gate', 'airport-gate'];
const ALL: PhotoKey[] = [...CABIN, ...EXTERIOR];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic pick so each page keeps the same image across builds. */
export function pickPhoto(seed: string, pool: 'all' | 'cabin' | 'exterior' = 'all'): PhotoKey {
  const list = pool === 'cabin' ? CABIN : pool === 'exterior' ? EXTERIOR : ALL;
  return list[hash(seed) % list.length];
}

/** Pick by topic words in a title, falling back to a hash. */
export function photoForText(text: string, seed = text): PhotoKey {
  const t = text.toLowerCase();
  if (/first class|suite|first/.test(t)) return 'first-suite';
  if (/business|lie.?flat|premium|pod|bunk|daybed/.test(t)) return 'business-cabin';
  if (/window|view|wing/.test(t)) return 'window-view';
  if (/gate|airport|boarding|checklist/.test(t)) return 'airport-gate';
  if (/economy|row|pitch|width|aisle|exit|bulkhead|seat/.test(t)) return 'economy-cabin';
  if (/aircraft|type|fleet|737|a320|a350|787|777/.test(t)) return pickPhoto(seed, 'exterior');
  return pickPhoto(seed);
}

export function photoForAircraft(label: string): PhotoKey {
  return /777|787|767|747|a330|a340|a350|a380|a300|a310|md.?11/i.test(label) ? 'widebody-gate' : 'aircraft-runway';
}
