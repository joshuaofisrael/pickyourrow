import type { AircraftConfig } from '../data/types';
import { scoreSeats } from './scoring';

/** Overhead cabin view: top down cutaway built only from the seat JSON. Nose on the left. */
const PITCH: Record<string, number> = { first: 48, business: 56, premium: 36, economy: 30 };
const COL = { good: '#4fb46e', caution: '#e8aa3c', exit: '#e14b41', std: '#afb6c3', lav: '#7896c8', gal: '#c8aa6e' };
const H = 300, TOP = 34, BOT = H - 34;

export type SeatKind = keyof typeof COL;
export function seatKind(tags: string[], score: number): SeatKind {
  if (tags.includes('exit')) return 'exit';
  if (score >= 7.5) return 'good';
  if (score <= 5) return 'caution';
  return 'std';
}

export interface OverheadResult { svg: string; seats: string[]; rows: number[]; exitRows: number[]; facilities: string[]; }

export function buildOverhead(config: AircraftConfig): OverheadResult {
  const score = new Map(scoreSeats(config).map((s) => [s.seatId, s]));
  const rows: { r: number; cab: AircraftConfig['cabins'][number] }[] = [];
  for (const cab of config.cabins)
    for (let r = cab.startRow; r <= cab.endRow; r++) if (!(cab.missingRows ?? []).includes(r)) rows.push({ r, cab });
  const W = rows.reduce((a, x) => a + (PITCH[x.cab.cabinClass] ?? 30), 0) + 170;
  const o: string[] = [];
  const seats: string[] = [], rowList: number[] = [], facs: string[] = [];
  const exits = new Set(config.exitRows);
  o.push(`<rect x="8" y="${TOP - 14}" width="${W - 16}" height="${BOT - TOP + 28}" rx="44" fill="#cdd0d6"/>`);
  o.push(`<rect x="14" y="${TOP}" width="${W - 28}" height="${BOT - TOP}" rx="36" fill="url(#cp)"/>`);
  for (let x = 40; x < W - 40; x += 18) o.push(`<rect x="${x}" y="${TOP - 10}" width="9" height="5" rx="2" class="w"/><rect x="${x}" y="${BOT + 5}" width="9" height="5" rx="2" class="w"/>`);
  const fac = (x: number, f: AircraftConfig['facilities'][number]) => {
    if (f.type === 'exit') { o.push(`<rect x="${x - 6}" y="${TOP - 13}" width="12" height="9" class="ex"/><rect x="${x - 6}" y="${BOT + 4}" width="12" height="9" class="ex"/>`); facs.push(`exit@${f.afterRow}`); return; }
    if (f.type === 'bulkhead') { o.push(`<line x1="${x}" x2="${x}" y1="${TOP + 4}" y2="${BOT - 4}" stroke="#e5e5e5" stroke-width="2"/>`); return; }
    const s = f.side ?? 'both';
    const [y0, y1] = s === 'left' ? [TOP + 6, TOP + 56] : s === 'right' ? [BOT - 56, BOT - 6] : s === 'center' ? [H / 2 - 26, H / 2 + 26] : [TOP + 6, BOT - 6];
    const lav = f.type === 'lav';
    o.push(`<rect x="${x - 12}" y="${y0}" width="24" height="${y1 - y0}" rx="3" fill="${lav ? COL.lav : COL.gal}"/><text x="${x}" y="${(y0 + y1) / 2 + 3}" class="f">${lav ? 'WC' : 'G'}</text>`);
    facs.push(`${f.type}@${f.afterRow}`);
  };
  for (const f of config.facilities) if (f.afterRow === 0) fac(62, f);
  let x = 92; const endX = new Map<number, number>();
  for (const { r, cab } of rows) {
    const p = PITCH[cab.cabinClass] ?? 30, blocks = cab.layout;
    const n = blocks.reduce((a, b) => a + b.letters.length, 0), ais = blocks.length - 1;
    const aw = 18, sw = Math.min(26, Math.floor((BOT - TOP - 16 - ais * aw) / n));
    let y = (H - (sw * n + aw * ais)) / 2;
    let aisleY = TOP + 10;
    blocks.forEach((b, bi) => {
      for (const L of b.letters) {
        const id = `${r}${L}`, sc = score.get(id);
        const k = sc ? seatKind(sc.tags, sc.score) : exits.has(r) ? 'exit' : 'std';
        o.push(`<g class="${k}"><rect x="${x + 3}" y="${y + 1.5}" width="${p - 7}" height="${sw - 3}" rx="4"/><rect x="${x + p - 10}" y="${y + 3}" width="5" height="${sw - 6}" rx="2" class="b"/><text x="${x + (p - 7) / 2}" y="${y + sw / 2 + 3.5}">${L}</text></g>`);
        seats.push(id); y += sw;
      }
      if (bi === 0 && ais) aisleY = y + aw / 2 + 3;
      y += aw;
    });
    o.push(`<text x="${x + p / 2}" y="${aisleY}" class="r">${r}</text>`);
    rowList.push(r); x += p; endX.set(r, x);
  }
  for (const f of config.facilities) { if (f.afterRow === 0) continue; const prev = rowList.filter((r) => r <= f.afterRow); const ex = prev.length ? endX.get(prev[prev.length - 1])! : 92; fac(ex + (f.type === 'lav' || f.type === 'galley' ? 13 : 0), f); }
  const css = `.good rect{fill:${COL.good}}.caution rect{fill:${COL.caution}}.exit rect{fill:${COL.exit}}.std rect{fill:${COL.std}}rect.b{fill:#000;opacity:.22}g text{font:700 9px sans-serif;fill:#fff;text-anchor:middle}.r{font:700 8px sans-serif;fill:#eee;text-anchor:middle}.f{font:700 9px sans-serif;fill:#fff;text-anchor:middle}.w{fill:#aacdeb}.ex{fill:${COL.exit}}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="ovt"><title id="ovt">Overhead cabin view of the ${config.name}: ${seats.length} seats drawn from the nose on the left to the tail on the right, with row numbers, seat letters, exit rows, lavatories and galleys</title><defs><pattern id="cp" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#4e525c"/><rect width="1" height="6" fill="#565a64"/></pattern></defs><style>${css}</style>${o.join('')}</svg>`;
  return { svg, seats, rows: rowList, exitRows: config.exitRows.filter((r) => rowList.includes(r)), facilities: facs };
}

/** Independent check of the drawing against the data and the existing chart's seat list. */
export function verifyOverhead(config: AircraftConfig, res: OverheadResult): string[] {
  const err: string[] = [];
  const exp: string[] = [];
  for (const c of config.cabins) for (let r = c.startRow; r <= c.endRow; r++) if (!(c.missingRows ?? []).includes(r)) for (const b of c.layout) for (const L of b.letters) exp.push(`${r}${L}`);
  const chart = scoreSeats(config).map((s) => s.seatId);
  if (exp.join() !== res.seats.join()) err.push('seat list differs from data');
  if ([...chart].sort().join() !== [...res.seats].sort().join()) err.push('seat list differs from chart');
  if (new Set(exp).size !== exp.length) err.push('duplicate seat ids');
  const svgSeats = (res.svg.match(/<g class=/g) ?? []).length;
  if (svgSeats !== exp.length) err.push(`svg seat count ${svgSeats} vs ${exp.length}`);
  for (const r of config.exitRows) if (!res.rows.includes(r)) err.push(`exit row ${r} not drawn`);
  const lg = config.facilities.filter((f) => f.type === 'lav' || f.type === 'galley' || f.type === 'exit');
  if (lg.length !== res.facilities.length) err.push('facility markers missing');
  const t = config.totalSeatsApprox; if (t && Math.abs(t - exp.length) / t > 0.1) err.push(`seat total ${exp.length} vs stated ${t}`);
  return err;
}
