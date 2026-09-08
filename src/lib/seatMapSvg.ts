import type { AircraftConfig, CabinClass, FacilityMarker } from '../data/types';

const CABIN_FILL: Record<CabinClass, string> = {
  first: '#1e3a5f',
  business: '#243b6b',
  premium: '#2f6f6a',
  economy: '#3d5a80',
};

const SEAT_W = 22;
const SEAT_H = 18;
const SEAT_GAP_X = 4;
const SEAT_GAP_Y = 6;
const AISLE_W = 18;
const MARGIN_X = 48;
const MARGIN_Y = 36;
const FACILITY_H = 16;

interface RowGeom {
  row: number;
  cabinClass: CabinClass;
  y: number;
  letters: { letter: string; x: number }[];
}

function cabinColor(c: CabinClass): string {
  return CABIN_FILL[c] ?? CABIN_FILL.economy;
}

function facilitySymbol(type: FacilityMarker['type']): { label: string; fill: string } {
  switch (type) {
    case 'lav':
      return { label: 'WC', fill: '#94a3b8' };
    case 'galley':
      return { label: 'GY', fill: '#a8a29e' };
    case 'exit':
      return { label: 'EXIT', fill: '#f59e0b' };
    case 'bulkhead':
      return { label: 'BH', fill: '#64748b' };
  }
}

/** Build original schematic SVG markup for an aircraft config. */
export function buildSeatMapSvg(config: AircraftConfig, opts?: { highlight?: Set<string>; title?: string }): string {
  const highlight = opts?.highlight;
  const rows: RowGeom[] = [];
  let y = MARGIN_Y;
  let maxSeatCols = 0;

  // Precompute max width from widest cabin layout
  for (const cabin of config.cabins) {
    let cols = 0;
    for (let i = 0; i < cabin.layout.length; i++) {
      cols += cabin.layout[i].letters.length;
      if (i < cabin.layout.length - 1) cols += 1; // aisle unit
    }
    maxSeatCols = Math.max(maxSeatCols, cols);
  }

  const contentWidth =
    MARGIN_X +
    maxSeatCols * (SEAT_W + SEAT_GAP_X) +
    AISLE_W + // buffer
    MARGIN_X;

  const facilityByAfter = new Map<number, FacilityMarker[]>();
  for (const f of config.facilities) {
    const list = facilityByAfter.get(f.afterRow) ?? [];
    list.push(f);
    facilityByAfter.set(f.afterRow, list);
  }

  // Nose
  y += 8;

  const parts: string[] = [];
  const drawFacilityBand = (afterRow: number) => {
    const list = facilityByAfter.get(afterRow);
    if (!list || list.length === 0) return;
    for (const f of list) {
      if (f.type === 'bulkhead') {
        parts.push(
          `<rect x="${MARGIN_X - 8}" y="${y}" width="${contentWidth - 2 * MARGIN_X + 16}" height="3" fill="#475569" rx="1"/>`,
        );
        y += 8;
        continue;
      }
      const sym = facilitySymbol(f.type);
      const bandW = contentWidth - 2 * MARGIN_X;
      parts.push(
        `<rect x="${MARGIN_X}" y="${y}" width="${bandW}" height="${FACILITY_H}" fill="${sym.fill}" opacity="0.35" rx="3"/>`,
      );
      parts.push(
        `<text x="${contentWidth / 2}" y="${y + FACILITY_H - 4}" text-anchor="middle" font-size="9" font-family="system-ui,sans-serif" fill="#1e293b" font-weight="600">${sym.label}${f.note ? '' : ''}</text>`,
      );
      if (f.type === 'exit') {
        parts.push(
          `<text x="${MARGIN_X - 6}" y="${y + FACILITY_H - 4}" text-anchor="end" font-size="8" fill="#b45309">◀</text>`,
        );
        parts.push(
          `<text x="${contentWidth - MARGIN_X + 6}" y="${y + FACILITY_H - 4}" text-anchor="start" font-size="8" fill="#b45309">▶</text>`,
        );
      }
      y += FACILITY_H + 4;
    }
  };

  drawFacilityBand(0);

  for (const cabin of config.cabins) {
    const missing = new Set(cabin.missingRows ?? []);
    // Cabin label
    parts.push(
      `<text x="${MARGIN_X - 4}" y="${y + 4}" font-size="10" font-family="system-ui,sans-serif" fill="#64748b" font-weight="600">${escapeXml(cabin.label)}</text>`,
    );
    y += 14;

    for (let row = cabin.startRow; row <= cabin.endRow; row++) {
      if (missing.has(row)) continue;

      let x = MARGIN_X;
      const letterGeoms: RowGeom['letters'] = [];

      for (let bi = 0; bi < cabin.layout.length; bi++) {
        const block = cabin.layout[bi];
        for (const letter of block.letters) {
          letterGeoms.push({ letter, x });
          const seatId = `${row}${letter}`;
          const isExit = config.exitRows.includes(row);
          const isHi = highlight?.has(seatId);
          const fill = isHi ? '#16a34a' : isExit ? '#0ea5e9' : cabinColor(cabin.cabinClass);
          const stroke = isHi ? '#14532d' : '#0f172a';
          parts.push(
            `<rect x="${x}" y="${y}" width="${SEAT_W}" height="${SEAT_H}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>`,
          );
          parts.push(
            `<text x="${x + SEAT_W / 2}" y="${y + SEAT_H / 2 + 3.5}" text-anchor="middle" font-size="8" font-family="system-ui,sans-serif" fill="#f8fafc">${letter}</text>`,
          );
          x += SEAT_W + SEAT_GAP_X;
        }
        if (bi < cabin.layout.length - 1) {
          x += AISLE_W - SEAT_GAP_X;
        }
      }

      // Row number
      parts.push(
        `<text x="${MARGIN_X - 10}" y="${y + SEAT_H / 2 + 3}" text-anchor="end" font-size="9" font-family="system-ui,sans-serif" fill="#475569">${row}</text>`,
      );

      rows.push({ row, cabinClass: cabin.cabinClass, y, letters: letterGeoms });
      y += SEAT_H + SEAT_GAP_Y;

      drawFacilityBand(row);
    }

    y += 6; // cabin gap
  }

  const height = y + MARGIN_Y;
  const width = Math.max(contentWidth, 280);
  const title = opts?.title ?? config.name;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${escapeXml(title)} seat map schematic">
  <title>${escapeXml(title)} — original Pick Your Row schematic</title>
  <desc>Original schematic reconstruction. Not an airline official diagram. Configurations vary by registration.</desc>
  <rect width="${width}" height="${height}" fill="#f1f5f9"/>
  <!-- fuselage outline -->
  <rect x="${MARGIN_X - 16}" y="${MARGIN_Y - 20}" width="${width - 2 * (MARGIN_X - 16)}" height="${height - MARGIN_Y}" fill="none" stroke="#94a3b8" stroke-width="2" rx="40"/>
  <!-- nose hint -->
  <ellipse cx="${width / 2}" cy="${MARGIN_Y - 28}" rx="36" ry="14" fill="none" stroke="#94a3b8" stroke-width="2"/>
  <text x="${width / 2}" y="18" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif" fill="#334155" font-weight="600">FRONT / NOSE</text>
  ${parts.join('\n  ')}
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="9" font-family="system-ui,sans-serif" fill="#64748b">Original Pick Your Row schematic · not affiliated with any airline</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
