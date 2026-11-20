// Content fingerprints for honest sitemap lastmod.
// A page's hash is the data that page is about, not the shared layout, so a
// footer or analytics edit does not stamp every URL with the build date.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = 'https://pickyourrow.com';

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function sha(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(text).digest('hex');
}

function typeSlug(aircraftType) {
  return aircraftType
    .toLowerCase()
    .replace(/boeing\s+/i, '')
    .replace(/airbus\s+/i, '')
    .replace(/\s+/g, '-');
}

function aircraftParam(config) {
  const prefix = `${config.airlineSlug}-`;
  return config.slug.startsWith(prefix) ? config.slug.slice(prefix.length) : config.slug;
}

function summarizeConfig(config) {
  return {
    slug: config.slug,
    airlineSlug: config.airlineSlug,
    aircraftType: config.aircraftType,
    totalSeatsApprox: config.totalSeatsApprox,
    exitRows: config.exitRows,
    notes: config.notes,
    cabins: config.cabins.map((cabin) => ({
      id: cabin.id,
      cabinClass: cabin.cabinClass,
      label: cabin.label,
      startRow: cabin.startRow,
      endRow: cabin.endRow,
      missingRows: cabin.missingRows ?? [],
      layout: cabin.layout.map((block) => block.letters),
    })),
  };
}

function topLevelObjects(text) {
  const lines = text.split('\n');
  const ranges = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '  {') start = i;
    else if (start >= 0 && (lines[i] === '  },' || lines[i] === '  }')) {
      const block = lines.slice(start, i + 1).join('\n');
      const slug = block.match(/"slug": "([^"]+)"/);
      ranges.push({ slug: slug ? slug[1] : '', start, end: i });
      start = -1;
    }
  }
  return ranges;
}

function blameDates(file) {
  let out = '';
  try {
    out = execFileSync('git', ['blame', '-w', '--line-porcelain', '--', file], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return [];
  }
  const dates = [];
  let authorTime = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('author-time ')) authorTime = Number(line.slice('author-time '.length));
    else if (line.startsWith('\t')) {
      const iso = new Date((authorTime || Date.now()) * 1000).toISOString().slice(0, 10);
      dates.push(iso);
    }
  }
  return dates;
}

function maxDate(dates, fallback) {
  const usable = dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
  if (!usable.length) return fallback;
  return usable.reduce((best, date) => (date > best ? date : best));
}

const STATIC_FILES = {
  '/': 'src/pages/index.astro',
  '/about/': 'src/pages/about/index.astro',
  '/aircraft/': 'src/pages/aircraft/index.astro',
  '/airlines/': 'src/pages/airlines/index.astro',
  '/best-seats/': 'src/pages/best-seats/index.astro',
  '/contact/': 'src/pages/contact/index.astro',
  '/disclaimer/': 'src/pages/disclaimer/index.astro',
  '/disclosure/': 'src/pages/disclosure/index.astro',
  '/guides/': 'src/pages/guides/index.astro',
  '/image-policy/': 'src/pages/image-policy/index.astro',
  '/methodology/': 'src/pages/methodology/index.astro',
  '/news/': 'src/pages/news/index.astro',
  '/privacy/': 'src/pages/privacy/index.astro',
  '/terms/': 'src/pages/terms/index.astro',
  '/data/seat-pitch-and-width/': 'src/pages/data/seat-pitch-and-width/index.astro',
};

/** @returns {Record<string, string>} url to content hash */
export function contentHashes() {
  const airlines = JSON.parse(read('src/data/airlines.json'));
  const aircraft = JSON.parse(read('src/data/aircraft.json'));
  const guides = JSON.parse(read('src/data/guides.json'));
  const news = JSON.parse(read('src/data/news.json'));
  let seatPitch = [];
  try {
    seatPitch = JSON.parse(read('src/data/seat-pitch.json'));
  } catch {
    seatPitch = [];
  }
  const booking = read('src/components/BookingCTA.astro');
  const byAirline = new Map();
  for (const config of aircraft) {
    const list = byAirline.get(config.airlineSlug) ?? [];
    list.push(config);
    byAirline.set(config.airlineSlug, list);
  }
  const byType = new Map();
  for (const config of aircraft) {
    const slug = typeSlug(config.aircraftType);
    const list = byType.get(slug) ?? [];
    list.push(config);
    byType.set(slug, list);
  }

  const hashes = {};
  const put = (path, payload) => {
    hashes[`${SITE}${path}`] = sha(payload);
  };

  for (const [path, file] of Object.entries(STATIC_FILES)) {
    const extra =
      path === '/data/seat-pitch-and-width/'
        ? seatPitch
        : path === '/'
          ? {
              airlines: airlines.length,
              aircraft: aircraft.length,
              guides: guides.map((guide) => guide.slug),
              news: news.map((item) => item.slug),
            }
          : path === '/airlines/'
            ? airlines.map((airline) => ({
                slug: airline.slug,
                name: airline.name,
                blurb: airline.blurb,
                configs: (byAirline.get(airline.slug) ?? []).length,
              }))
            : path === '/aircraft/'
              ? [...byType.entries()].map(([slug, configs]) => ({
                  slug,
                  label: configs[0].aircraftType,
                  count: configs.length,
                }))
              : path === '/guides/'
                ? guides.map((guide) => ({ slug: guide.slug, title: guide.title, description: guide.description }))
                : path === '/news/'
                  ? news.map((item) => ({
                      slug: item.slug,
                      title: item.title,
                      description: item.description,
                      datePublished: item.datePublished,
                    }))
                  : path === '/best-seats/'
                    ? aircraft.map((config) => ({
                        slug: config.slug,
                        airlineSlug: config.airlineSlug,
                        seats: config.totalSeatsApprox,
                      }))
                    : null;
    put(path, { file: read(file), extra });
  }

  for (const airline of airlines) {
    put(`/airlines/${airline.slug}/`, {
      airline,
      configs: (byAirline.get(airline.slug) ?? []).map(summarizeConfig),
    });
  }
  for (const config of aircraft) {
    put(`/airlines/${config.airlineSlug}/${aircraftParam(config)}/seat-map/`, {
      config,
      booking,
    });
  }
  for (const [slug, configs] of byType) {
    put(`/aircraft/${slug}/`, { configs: configs.map(summarizeConfig) });
  }
  for (const guide of guides) put(`/guides/${guide.slug}/`, guide);
  for (const item of news) put(`/news/${item.slug}/`, item);
  return hashes;
}

/**
 * Last content date per URL from git blame of the data behind the hash.
 * Uncommitted lines use today's blame date. Shared layout files are not included,
 * except BookingCTA, which is body copy on every seat map.
 */
export function contentDates(fallback) {
  const airlinesText = read('src/data/airlines.json');
  const aircraftText = read('src/data/aircraft.json');
  const guidesText = read('src/data/guides.json');
  const newsText = read('src/data/news.json');
  const airlines = JSON.parse(airlinesText);
  const aircraft = JSON.parse(aircraftText);
  const guides = JSON.parse(guidesText);
  const news = JSON.parse(newsText);

  const airlineBlame = blameDates('src/data/airlines.json');
  const aircraftBlame = blameDates('src/data/aircraft.json');
  const guideBlame = blameDates('src/data/guides.json');
  const newsBlame = blameDates('src/data/news.json');
  const bookingBlame = blameDates('src/components/BookingCTA.astro');
  const bookingDate = maxDate(bookingBlame, fallback);

  const rangeDate = (blame, ranges, slug) => {
    const range = ranges.find((item) => item.slug === slug);
    if (!range) return fallback;
    return maxDate(blame.slice(range.start, range.end + 1), fallback);
  };
  const fileDate = (file) => maxDate(blameDates(file), fallback);

  const airlineRanges = topLevelObjects(airlinesText);
  const aircraftRanges = topLevelObjects(aircraftText);
  const guideRanges = topLevelObjects(guidesText);
  const newsRanges = topLevelObjects(newsText);

  const airlineDate = new Map(airlines.map((airline) => [airline.slug, rangeDate(airlineBlame, airlineRanges, airline.slug)]));
  const configDate = new Map(aircraft.map((config) => [config.slug, rangeDate(aircraftBlame, aircraftRanges, config.slug)]));
  const byAirline = new Map();
  for (const config of aircraft) {
    const list = byAirline.get(config.airlineSlug) ?? [];
    list.push(config);
    byAirline.set(config.airlineSlug, list);
  }
  const byType = new Map();
  for (const config of aircraft) {
    const slug = typeSlug(config.aircraftType);
    const list = byType.get(slug) ?? [];
    list.push(config);
    byType.set(slug, list);
  }

  const dates = {};
  const put = (path, date) => {
    dates[`${SITE}${path}`] = date;
  };

  for (const [path, file] of Object.entries(STATIC_FILES)) {
    let date = fileDate(file);
    if (path === '/airlines/') date = maxDate([date, ...airlineDate.values()], fallback);
    if (path === '/aircraft/' || path === '/best-seats/') date = maxDate([date, ...configDate.values()], fallback);
    if (path === '/guides/') {
      date = maxDate(
        [date, ...guides.map((guide) => rangeDate(guideBlame, guideRanges, guide.slug))],
        fallback,
      );
    }
    if (path === '/news/') {
      date = maxDate([date, ...news.map((item) => rangeDate(newsBlame, newsRanges, item.slug))], fallback);
    }
    if (path === '/') {
      date = maxDate(
        [date, ...guides.map((guide) => rangeDate(guideBlame, guideRanges, guide.slug)), ...news.map((item) => rangeDate(newsBlame, newsRanges, item.slug))],
        fallback,
      );
    }
    put(path, date);
  }

  for (const airline of airlines) {
    const configDates = (byAirline.get(airline.slug) ?? []).map((config) => configDate.get(config.slug));
    put(`/airlines/${airline.slug}/`, maxDate([airlineDate.get(airline.slug), ...configDates], fallback));
  }
  for (const config of aircraft) {
    put(
      `/airlines/${config.airlineSlug}/${aircraftParam(config)}/seat-map/`,
      maxDate([configDate.get(config.slug), bookingDate], fallback),
    );
  }
  for (const [slug, configs] of byType) {
    put(`/aircraft/${slug}/`, maxDate(configs.map((config) => configDate.get(config.slug)), fallback));
  }
  for (const guide of guides) put(`/guides/${guide.slug}/`, rangeDate(guideBlame, guideRanges, guide.slug));
  for (const item of news) put(`/news/${item.slug}/`, rangeDate(newsBlame, newsRanges, item.slug));
  return dates;
}
