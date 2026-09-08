import { aircraftConfigs, getAirline } from '../data';
import type { AircraftConfig, Airline } from '../data/types';

/** Resolve /airlines/[airline]/[aircraft]/… where aircraft is like "737-900er". */
export function resolveAirlineAircraft(
  airlineSlug: string,
  aircraftParam: string,
): { airline: Airline; config: AircraftConfig } | undefined {
  const airline = getAirline(airlineSlug);
  if (!airline) return undefined;

  const param = aircraftParam.toLowerCase();
  const candidates = aircraftConfigs.filter((c) => c.airlineSlug === airlineSlug);
  const config =
    candidates.find((c) => c.slug === `${airlineSlug}-${param}`) ||
    candidates.find((c) => c.slug.endsWith(`-${param}`)) ||
    candidates.find((c) => {
      const t = c.aircraftType
        .toLowerCase()
        .replace(/boeing\s+/i, '')
        .replace(/airbus\s+/i, '')
        .replace(/\s+/g, '-');
      return t === param;
    });

  if (!config) return undefined;
  return { airline, config };
}

export function aircraftUrlParam(config: AircraftConfig): string {
  return config.slug.replace(new RegExp(`^${config.airlineSlug}-`), '');
}
