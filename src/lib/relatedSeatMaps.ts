import type { Airline, AircraftConfig } from '../data/types';
import { shortAircraftType } from './leafMeta';

/** Other airlines on the same type. Smaller groups keep every airline. */
export const PEER_SEAT_MAP_LIMIT = 6;

export interface SeatMapLink {
  href: string;
  label: string;
}

/**
 * URL slug for /aircraft/{type}/.
 * Must stay aligned with getUniqueAircraftTypes in src/data/index.ts.
 */
export function aircraftTypeSlug(aircraftType: string): string {
  return aircraftType
    .toLowerCase()
    .replace(/boeing\s+/i, '')
    .replace(/airbus\s+/i, '')
    .replace(/\s+/g, '-');
}

/** Leaf path /airlines/{airline}/{type}/seat-map/. */
export function seatMapPath(config: AircraftConfig): string {
  const param = config.slug.replace(new RegExp(`^${config.airlineSlug}-`), '');
  return `/airlines/${config.airlineSlug}/${param}/seat-map/`;
}

export function typeHubPath(config: AircraftConfig): string {
  return `/aircraft/${aircraftTypeSlug(config.aircraftType)}/`;
}

export function typeHubAnchor(aircraftType: string): string {
  const label = `All ${aircraftType} seat maps by airline`;
  assertAnchor(label);
  return label;
}

export function seatMapAnchor(airlineName: string, aircraftType: string): string {
  return `${airlineName} ${shortAircraftType(aircraftType)} seat map`;
}

function assertAnchor(label: string): void {
  if (/[–—]/.test(label) || /\s-\s/.test(label)) {
    throw new Error(`Related link anchor has a forbidden dash: ${label}`);
  }
}

function airlineBySlug(airlines: Airline[], slug: string): Airline {
  const airline = airlines.find((item) => item.slug === slug);
  if (!airline) throw new Error(`Missing airline for ${slug}`);
  return airline;
}

function byName(left: string, right: string): number {
  return left.localeCompare(right, 'en', { sensitivity: 'base' });
}

function toLink(airline: Airline, config: AircraftConfig): SeatMapLink {
  const link = {
    href: seatMapPath(config),
    label: seatMapAnchor(airline.name, config.aircraftType),
  };
  assertAnchor(link.label);
  return link;
}

/** Other aircraft seat maps for this airline, alphabetical by anchor. */
export function siblingSeatMaps(
  config: AircraftConfig,
  airlines: Airline[],
  configs: AircraftConfig[],
): SeatMapLink[] {
  return configs
    .filter((item) => item.airlineSlug === config.airlineSlug && item.slug !== config.slug)
    .map((item) => toLink(airlineBySlug(airlines, item.airlineSlug), item))
    .sort((a, b) => byName(a.label, b.label) || a.href.localeCompare(b.href));
}

/**
 * Other airlines' seat maps for this aircraft type.
 * Alphabetical. When more than the cap exist, take the next names after the
 * current airline and wrap, so the set is stable and every airline is linked.
 */
export function peerSeatMaps(
  config: AircraftConfig,
  airlines: Airline[],
  configs: AircraftConfig[],
  limit = PEER_SEAT_MAP_LIMIT,
): SeatMapLink[] {
  const type = aircraftTypeSlug(config.aircraftType);
  const sameType = configs
    .filter((item) => aircraftTypeSlug(item.aircraftType) === type)
    .map((item) => ({ item, airline: airlineBySlug(airlines, item.airlineSlug) }))
    .sort((a, b) => byName(a.airline.name, b.airline.name) || a.item.slug.localeCompare(b.item.slug));

  const others = sameType.filter((entry) => entry.item.slug !== config.slug);
  if (others.length <= limit) return others.map((entry) => toLink(entry.airline, entry.item));

  const index = sameType.findIndex((entry) => entry.item.slug === config.slug);
  if (index < 0) throw new Error(`Config missing from type group: ${config.slug}`);

  const picked: SeatMapLink[] = [];
  for (let step = 1; picked.length < limit && step < sameType.length; step++) {
    const entry = sameType[(index + step) % sameType.length];
    if (entry.item.slug === config.slug) continue;
    picked.push(toLink(entry.airline, entry.item));
  }
  return picked;
}
