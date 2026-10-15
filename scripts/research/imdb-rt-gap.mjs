#!/usr/bin/env node
// Reproduces data/imdb-rt-gap.json: IMDb vs Rotten Tomatoes scores for a fixed
// list of Netflix Originals, fetched from OMDb.
//
//   node scripts/research/imdb-rt-gap.mjs            # uses cache, fetches only what is missing
//   node scripts/research/imdb-rt-gap.mjs --refresh  # ignore cache, re-fetch everything
//
// Needs Node 22.18+ (it imports lib/research-stats.ts via built-in type stripping).
// API key: OMDB_API_KEY env var, otherwise the public key already shipped in extension/background.js.
// OMDb returns no Rotten Tomatoes score for TV series, so the usable sample is films only; the
// series stay in the candidate list and show up under "excluded" instead of being dropped silently.
// Safety: the script aborts WITHOUT writing output on any network error or OMDb quota/auth
// error, and never fills in a missing number.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize } from '../../lib/research-stats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE_FILE = join(ROOT, 'data', 'omdb-cache.json');
const OUT_FILE = join(ROOT, 'data', 'imdb-rt-gap.json');
const PUBLIC_COPY = join(ROOT, 'public', 'data', 'imdb-rt-gap.json');
const MAX_REQUESTS = 110;
const DELAY_MS = 400;

// Selection rule (fixed BEFORE any score was fetched; no title was added, dropped or
// swapped after seeing a result): Netflix Original films and series that are widely
// discussed or award-winning, written down in one pass. Netflix Originals, not licensed
// titles, because their Netflix status does not depend on regional catalogues.
// [title, year (first release year), OMDb type]
const CANDIDATES = [
  // Films
  ['Roma', 2018, 'movie'],
  ['The Irishman', 2019, 'movie'],
  ['Marriage Story', 2019, 'movie'],
  ['Bird Box', 2018, 'movie'],
  ['Glass Onion: A Knives Out Mystery', 2022, 'movie'],
  ['All Quiet on the Western Front', 2022, 'movie'],
  ['The Power of the Dog', 2021, 'movie'],
  ["Don't Look Up", 2021, 'movie'],
  ['Red Notice', 2021, 'movie'],
  ['The Gray Man', 2022, 'movie'],
  ['Extraction', 2020, 'movie'],
  ['The Adam Project', 2022, 'movie'],
  ['Enola Holmes', 2020, 'movie'],
  ['Klaus', 2019, 'movie'],
  ['The Mitchells vs. the Machines', 2021, 'movie'],
  ['Okja', 2017, 'movie'],
  ['The Two Popes', 2019, 'movie'],
  ['Mudbound', 2017, 'movie'],
  ['Bright', 2017, 'movie'],
  ['Army of the Dead', 2021, 'movie'],
  ['The Old Guard', 2020, 'movie'],
  ['Project Power', 2020, 'movie'],
  ['6 Underground', 2019, 'movie'],
  ['Triple Frontier', 2019, 'movie'],
  ['Murder Mystery', 2019, 'movie'],
  ['The Kissing Booth', 2018, 'movie'],
  ["To All the Boys I've Loved Before", 2018, 'movie'],
  ['Tick, Tick... Boom!', 2021, 'movie'],
  ['The Trial of the Chicago 7', 2020, 'movie'],
  ["Ma Rainey's Black Bottom", 2020, 'movie'],
  ['Mank', 2020, 'movie'],
  ['Da 5 Bloods', 2020, 'movie'],
  ["I'm Thinking of Ending Things", 2020, 'movie'],
  ['Hustle', 2022, 'movie'],
  ["Guillermo del Toro's Pinocchio", 2022, 'movie'],
  ['Nimona', 2023, 'movie'],
  ['Leave the World Behind', 2023, 'movie'],
  ['Rebel Moon - Part One: A Child of Fire', 2023, 'movie'],
  ['Maestro', 2023, 'movie'],
  ['Society of the Snow', 2023, 'movie'],
  ['Atlas', 2024, 'movie'],
  ['Carry-On', 2024, 'movie'],
  ['The Platform', 2019, 'movie'],
  ['Spenser Confidential', 2020, 'movie'],
  ['The Midnight Sky', 2020, 'movie'],
  ['Moxie', 2021, 'movie'],
  ['Fear Street: 1994', 2021, 'movie'],
  ['Malcolm & Marie', 2021, 'movie'],
  ['Rustin', 2023, 'movie'],
  ['Lift', 2024, 'movie'],
  // Series
  ['Stranger Things', 2016, 'series'],
  ['The Crown', 2016, 'series'],
  ['Squid Game', 2021, 'series'],
  ['Wednesday', 2022, 'series'],
  ['Bridgerton', 2020, 'series'],
  ['The Witcher', 2019, 'series'],
  ['Ozark', 2017, 'series'],
  ['Narcos', 2015, 'series'],
  ['Mindhunter', 2017, 'series'],
  ['Black Mirror', 2011, 'series'],
  ["The Queen's Gambit", 2020, 'series'],
  ['Dark', 2017, 'series'],
  ['Money Heist', 2017, 'series'],
  ['Lupin', 2021, 'series'],
  ['Sex Education', 2019, 'series'],
  ['Cobra Kai', 2018, 'series'],
  ['You', 2018, 'series'],
  ['13 Reasons Why', 2017, 'series'],
  ['The Umbrella Academy', 2019, 'series'],
  ['BoJack Horseman', 2014, 'series'],
  ['Arcane', 2021, 'series'],
  ['Beef', 2023, 'series'],
  ['Baby Reindeer', 2024, 'series'],
  ['Adolescence', 2025, 'series'],
  ['The Sandman', 2022, 'series'],
  ['One Piece', 2023, 'series'],
  ['Avatar: The Last Airbender', 2024, 'series'],
  ['3 Body Problem', 2024, 'series'],
  ['Love, Death & Robots', 2019, 'series'],
  ['Ginny & Georgia', 2021, 'series'],
  ['Heartstopper', 2022, 'series'],
  ['Orange Is the New Black', 2013, 'series'],
  ['House of Cards', 2013, 'series'],
  ['Daredevil', 2015, 'series'],
  ['The Haunting of Hill House', 2018, 'series'],
  ['Monster: The Jeffrey Dahmer Story', 2022, 'series'],
  ['Tiger King', 2020, 'series'],
  ['Making a Murderer', 2015, 'series'],
];

// Values that disagree with the public Rotten Tomatoes page. Kept in the data exactly as OMDb
// returned them (the study measures what OMDb, and so the extension, serves) but flagged, and
// reported with and without them. Only the single largest outlier was checked by hand.
const FLAGGED = [
  {
    title: "Guillermo del Toro's Pinocchio",
    omdbRtPercent: 27,
    rtSitePercent: 96,
    rtSiteReviews: 298,
    checkedOn: '2026-10-15',
    checkedUrl: 'https://www.rottentomatoes.com/m/guillermo_del_toros_pinocchio',
  },
];

const fail = (msg) => {
  console.error(`ABORT: ${msg}\nNo output was written.`);
  process.exit(1);
};

function apiKey() {
  if (process.env.OMDB_API_KEY) return process.env.OMDB_API_KEY;
  const src = readFileSync(join(ROOT, 'extension', 'background.js'), 'utf8');
  const m = src.match(/OMDB_API_KEY\s*=\s*'([^']+)'/);
  if (!m) fail('No OMDB_API_KEY env var and could not find the key in extension/background.js');
  return m[1];
}

const refresh = process.argv.includes('--refresh');
const cache = !refresh && existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : { responses: {} };
const key = apiKey();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cacheKey = ([title, year, type]) => `${title}|${year}|${type}`;

let requests = 0;
async function lookup(candidate) {
  const k = cacheKey(candidate);
  if (cache.responses[k]) return cache.responses[k].data;
  if (requests >= MAX_REQUESTS) fail(`Request budget (${MAX_REQUESTS}) exhausted`);
  const [title, year, type] = candidate;
  const url =
    `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&y=${year}&type=${type}&apikey=${key}`;
  requests++;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (e) {
    fail(`OMDb unreachable for "${title}": ${e.message}`);
  }
  if (!res.ok) fail(`OMDb HTTP ${res.status} for "${title}" (rate-limited or unavailable)`);
  const data = await res.json();
  // "Movie not found!" is a legitimate answer; anything else with Response:"False" is a service problem.
  if (data.Response === 'False' && !/not found/i.test(data.Error ?? '')) {
    fail(`OMDb error for "${title}": ${data.Error}`);
  }
  cache.responses[k] = { fetchedAt: new Date().toISOString(), data };
  mkdirSync(dirname(CACHE_FILE), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1) + '\n');
  await sleep(DELAY_MS);
  return data;
}

const num = (s) => (s && s !== 'N/A' ? Number(s.replace(/,/g, '')) : null);

const titles = [];
const excluded = [];
for (const candidate of CANDIDATES) {
  const [title, year, type] = candidate;
  const d = await lookup(candidate);
  if (d.Response === 'False') {
    excluded.push({ title, year, type, reason: 'Not found in OMDb' });
    continue;
  }
  const startYear = Number.parseInt(d.Year, 10);
  if (d.Type !== type || Math.abs(startYear - year) > 1) {
    excluded.push({ title, year, type, reason: `OMDb resolved to a different title (${d.Title}, ${d.Year}, ${d.Type})` });
    continue;
  }
  const imdb = num(d.imdbRating);
  const rtRaw = d.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value;
  const rt = rtRaw ? Number.parseInt(rtRaw, 10) : null;
  if (imdb === null || rt === null || Number.isNaN(rt)) {
    excluded.push({ title, year, type, reason: `Missing ${imdb === null ? 'IMDb rating' : 'Rotten Tomatoes score'} in OMDb` });
    continue;
  }
  titles.push({
    title: d.Title,
    year,
    type,
    imdbId: d.imdbID,
    imdbRating: imdb,
    imdbVotes: num(d.imdbVotes),
    rtPercent: rt,
  });
}

if (titles.length < 20) fail(`Only ${titles.length} usable titles; refusing to publish a study this thin`);

const toPairs = (ts) => ts.map((t) => ({ ...t, imdb: t.imdbRating, rt: t.rtPercent }));
const fetchedDates = Object.values(cache.responses).map((r) => r.fetchedAt).sort();
const out = {
  name: 'IMDb vs Rotten Tomatoes scores for popular Netflix Original films',
  description:
    'IMDb rating (0-10) and Rotten Tomatoes Tomatometer (0-100%) for Netflix Original films, as returned by the OMDb API. Gap = RT% minus IMDb x10; positive means critics rated it higher.',
  source: 'OMDb API (https://www.omdbapi.com/)',
  license: 'Scores belong to IMDb and Rotten Tomatoes; this file is a small factual snapshot for research and reproduction.',
  fetchedAt: fetchedDates[fetchedDates.length - 1],
  fetchedFrom: fetchedDates[0],
  selectionRule:
    'Netflix Original films and series that are widely discussed or award-winning, listed in scripts/research/imdb-rt-gap.mjs before any score was fetched. No title was added, removed or swapped after seeing its result; titles OMDb could not score are listed under "excluded". OMDb returned no Rotten Tomatoes score for any TV series, so every usable title is a film.',
  candidates: CANDIDATES.length,
  omdbRequests: Object.keys(cache.responses).length,
  script: 'scripts/research/imdb-rt-gap.mjs',
  titles,
  excluded,
  flagged: FLAGGED,
  summary: summarize(toPairs(titles)),
  summaryExcludingFlagged: summarize(toPairs(titles.filter((t) => !FLAGGED.some((f) => f.title === t.title)))),
};
// Summary rows hold the full title objects; keep the file tidy by trimming extremes to identifiers.
for (const sum of [out.summary, out.summaryExcludingFlagged]) {
  for (const k of ['biggestCriticsHigher', 'biggestAudienceHigher']) {
    const r = sum[k];
    if (r) sum[k] = { title: r.title, imdb: r.imdb, rt: r.rt, gap: r.gap };
  }
}

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');
mkdirSync(dirname(PUBLIC_COPY), { recursive: true });
copyFileSync(OUT_FILE, PUBLIC_COPY);
console.log(`Requests made this run: ${requests}. Usable: ${titles.length}, excluded: ${excluded.length} of ${CANDIDATES.length}.`);
console.log(JSON.stringify(out.summary, null, 2));
