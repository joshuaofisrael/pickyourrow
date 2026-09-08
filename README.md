# Pick Your Row (pickyourrow.com)

Lean MVP: original SVG airline cabin schematics + editorial best-seat heuristics.

**Brand:** Pick Your Row / pickyourrow.com
**Owner:** Joshua Israel Ventures LLC

## Run

```bash
cd /workspace/pickyourrow
npm install
npm run dev
npm run build
npm run preview
```

Requires Node.js >= 20.3.

## Legal rules (hard)

- NEVER scrape competitor maps or airline diagrams.
- Original SVG schematics from public config facts only.
- Airline names OK factually; never imply affiliation.
- Footer: (c) Joshua Israel Ventures LLC + disclaimer.

## Content pack format

JSON under src/data/:
- airlines.json — carriers
- aircraft.json — cabin configs
- guides.json — guides
- types.ts — types

Aircraft fields: slug, airlineSlug, aircraftType, aircraftFamily, name, configNote, totalSeatsApprox, cabins[], exitRows[], facilities[], notes[].
Cabin: id, cabinClass, label, startRow, endRow, layout[{letters}], missingRows?.
Layout blocks are separated by aisles.

## How to add an airline

1. Append to src/data/airlines.json with unique slug.
2. Add configs in aircraft.json with matching airlineSlug.
3. Rebuild. Routes under /airlines/ and /best-seats/.

URL [aircraft] = config slug minus airline prefix (delta-737-900er -> 737-900er).

## How to add an aircraft config

1. Copy an aircraft.json entry.
2. Set slug, airlineSlug, cabins, exitRows, facilities.
3. Honest configNote (illustrative / varies by registration).
4. Prefer conservative publicly known typical layouts.

## SVG engine

src/lib/seatMapSvg.ts — original schematic SVGs.

## Scoring

src/lib/scoring.ts — editorial heuristic. FAQ JSON-LD on best-seats pages.

## Stack

Astro + TypeScript + @astrojs/sitemap. Mobile-first CSS.
