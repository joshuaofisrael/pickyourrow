import airlinesJson from './airlines.json';
import aircraftJson from './aircraft.json';
import type { Airline, AircraftConfig } from './types';

export const airlines = airlinesJson as Airline[];
export const aircraftConfigs = aircraftJson as AircraftConfig[];

export function getAirline(slug: string): Airline | undefined {
  return airlines.find((a) => a.slug === slug);
}

export function getAircraft(slug: string): AircraftConfig | undefined {
  return aircraftConfigs.find((a) => a.slug === slug);
}

export function getAircraftByAirline(airlineSlug: string): AircraftConfig[] {
  return aircraftConfigs.filter((a) => a.airlineSlug === airlineSlug);
}

export function getAircraftByType(typeSlug: string): AircraftConfig[] {
  // typeSlug like "737-900er" or "a320" — match aircraftType slugified-ish
  const norm = typeSlug.toLowerCase().replace(/\s+/g, '-');
  return aircraftConfigs.filter((a) => {
    const t = a.aircraftType.toLowerCase().replace(/\s+/g, '-');
    const fam = a.aircraftFamily.toLowerCase();
    return t === norm || t.includes(norm) || fam === norm || a.slug.endsWith(`-${norm}`);
  });
}

/** Unique aircraft type pages: keyed by a URL-friendly type slug */
export function getUniqueAircraftTypes(): { typeSlug: string; label: string; configs: AircraftConfig[] }[] {
  const map = new Map<string, { label: string; configs: AircraftConfig[] }>();
  for (const c of aircraftConfigs) {
    const typeSlug = c.aircraftType
      .toLowerCase()
      .replace(/boeing\s+/i, '')
      .replace(/airbus\s+/i, '')
      .replace(/\s+/g, '-');
    const existing = map.get(typeSlug);
    if (existing) {
      existing.configs.push(c);
    } else {
      map.set(typeSlug, { label: c.aircraftType, configs: [c] });
    }
  }
  return Array.from(map.entries()).map(([typeSlug, v]) => ({ typeSlug, ...v }));
}

export function layoutString(config: AircraftConfig): string {
  const eco = [...config.cabins].reverse().find((c) => c.cabinClass === 'economy') ?? config.cabins[config.cabins.length - 1];
  return eco.layout.map((b) => b.letters.length).join('-');
}
