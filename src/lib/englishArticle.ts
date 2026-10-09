/**
 * "a" or "an" from the spoken start of a name.
 * A vowel letter usually takes "an". United and similar names that start
 * with a "you" sound take "a" (a United Airlines seat map, a European airline).
 * A silent h (hour, honest) keeps "an" because the spoken name starts with a vowel.
 */
const YOU_SOUND_PREFIXES = [
  'unanim',
  'unicorn',
  'uniform',
  'unify',
  'unilateral',
  'unison',
  'united',
  'unique',
  'union',
  'universe',
  'university',
  'unit',
  'use',
  'usual',
  'utop',
  'util',
  'ukrain',
  'ubiqu',
  'uran',
  'ufo',
  'uk',
  'euro',
  'eu',
];

const SILENT_H = /^(?:hour|honest|honou?r|heir)/i;

export function indefiniteArticle(name: string): 'a' | 'an' {
  const word = name.trim().match(/[A-Za-z]+/)?.[0]?.toLowerCase() ?? '';
  if (SILENT_H.test(word)) return 'an';
  if (YOU_SOUND_PREFIXES.some((prefix) => word.startsWith(prefix))) return 'a';
  if (/^[aeiou]/.test(word)) return 'an';
  return 'a';
}

/** Build fails if United-style names regress to "an", or vowel sounds lose "an". */
export function assertIndefiniteArticleSamples(): void {
  const samples: [string, 'a' | 'an'][] = [
    ['United Airlines', 'a'],
    ['university', 'a'],
    ['unique cabin', 'a'],
    ['European airline', 'a'],
    ['user guide', 'a'],
    ['useful note', 'a'],
    ['Ukrainian carrier', 'a'],
    ['umbrella', 'an'],
    ['ultra low cost', 'an'],
    ['unidentified type', 'an'],
    ['American Airlines', 'an'],
    ['easyJet', 'an'],
    ['Alaska Airlines', 'an'],
    ['ANA (All Nippon Airways)', 'an'],
    ['EVA Air', 'an'],
    ['Air France', 'an'],
    ['Emirates', 'an'],
    ['Aegean Airlines', 'an'],
    ['EgyptAir', 'an'],
    ['Iberia', 'an'],
    ['IndiGo', 'an'],
    ['SWISS', 'a'],
    ['KLM Royal Dutch Airlines', 'a'],
    ['LATAM Airlines', 'a'],
    ['LOT Polish Airlines', 'a'],
    ['TAP Air Portugal', 'a'],
    ['Qantas', 'a'],
    ['Delta Air Lines', 'a'],
    ['honest broker', 'an'],
    ['hour', 'an'],
  ];
  for (const [name, expected] of samples) {
    const actual = indefiniteArticle(name);
    if (actual !== expected) {
      throw new Error(`Indefinite article for "${name}" was "${actual}", expected "${expected}"`);
    }
  }
}
