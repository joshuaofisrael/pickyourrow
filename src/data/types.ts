/** Content-pack types for Pick Your Row cabin schematics. */

export type CabinClass = 'first' | 'business' | 'premium' | 'economy';

export interface Airline {
  slug: string;
  name: string;
  iata: string;
  country: string;
  blurb: string;
}

export interface SeatBlock {
  /** Seat letters in this block, left-to-right, e.g. ["A","B","C"] */
  letters: string[];
}

export interface CabinSection {
  id: string;
  cabinClass: CabinClass;
  label: string;
  /** First row number in this section */
  startRow: number;
  /** Last row number inclusive */
  endRow: number;
  /** Seat blocks separated by aisles */
  layout: SeatBlock[];
  /** Rows skipped / not present (e.g. jump from 11 to 14) */
  missingRows?: number[];
}

export interface FacilityMarker {
  /** Row after which this facility sits (0 = before first row) */
  afterRow: number;
  type: 'lav' | 'galley' | 'exit' | 'bulkhead';
  side?: 'left' | 'right' | 'both' | 'center';
  note?: string;
}

export interface AircraftConfig {
  slug: string;
  airlineSlug: string;
  aircraftType: string;
  aircraftFamily: string;
  name: string;
  /** Short disclaimer shown on every map */
  configNote: string;
  totalSeatsApprox: number;
  cabins: CabinSection[];
  exitRows: number[];
  facilities: FacilityMarker[];
  /** Extra editorial notes */
  notes: string[];
}

export type ScoreTag =
  | 'exit'
  | 'bulkhead'
  | 'extra-legroom'
  | 'window'
  | 'aisle'
  | 'middle'
  | 'near-lav'
  | 'near-galley'
  | 'rear'
  | 'quiet'
  | 'standard';

export interface SeatScore {
  seatId: string; // e.g. "12A"
  row: number;
  letter: string;
  cabinClass: CabinClass;
  score: number; // 1–10 editorial heuristic
  tags: ScoreTag[];
  summary: string;
}
