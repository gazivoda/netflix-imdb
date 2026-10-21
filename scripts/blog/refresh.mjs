#!/usr/bin/env node
// Builds data/blog/films.json: the 100 most-watched Netflix films (Netflix's own Top 10 data, rule R1)
// that pass the OMDb eligibility checks (rule R2). Spec: docs/superpowers/specs/2026-10-20-blog-top-100-design.md
// sections 1 and 2. Local only: never run in CI or at build time.
//
//   node --env-file=.env.local scripts/blog/refresh.mjs --list --scores
//
//   --list      read Netflix's two TSV files (local copies in data/blog/source/raw/ first, download only if
//               a file is missing), rank the films, write data/blog/source/netflix-candidates.json (pool of 250)
//   --scores    walk the pool in order, resolve each title to an IMDb id through OMDb, apply the eligibility
//               rules, and write data/blog/films.json + public/data/netflix-top-100.json once 100 are eligible.
//               Resumable: every OMDb response is cached before the next request (see below).
//   --refresh   with --scores: re-fetch the OMDb record (`?i=`) of every film the walk reaches, even if cached
//   --help
//
// Needs Node 20.6+ (--env-file). BLOG_OMDB_API_KEY (preferred) or OMDB_API_KEY comes from the environment; the script never prints the key,
// a request URL or process.env.
//
// Files
//   data/blog/source/raw/*.tsv           Netflix downloads (git-ignored)
//   data/blog/source/netflix-candidates.json   the ranked pool (committed instead of the 900 KB TSV)
//   data/blog/source/overrides.json      identity-only overrides [{ netflixTitle, imdbId, reason, category? }]
//   data/blog/source/omdb-lookups.json   query -> imdbId / search hits cache (so "not found" answers are not re-asked)
//   data/blog/omdb-raw.json              { [imdbId]: { fetchedAt, data } } full OMDb record, same idea as data/omdb-cache.json
//   data/blog/source/doubtful.json       accepted matches whose OMDb year is below the first chart year (C1), for a
//                                        human decision; also printed as DOUBTFUL lines at the end of the match phase
//   data/blog/articles/*.json            read only for their slugs: a slug used by any article stays reserved
//
// Deliberate deviation from the spec text: the `?t=` response is already the full record (plot=short is sent
// explicitly), so it is stored directly and the extra `?i=` call is skipped; `?i=` is used for search hits,
// overrides and --refresh. Saves about one request per film.
//
// Safety (same rules as scripts/research/imdb-rt-gap.mjs): films.json is only written when 100 films are
// eligible. A network error, "Request limit reached", "Invalid API key" or a schema mismatch aborts without
// writing it; the caches written so far stay, so a re-run resumes. MAX_REQUESTS caps one run.
// A missing value is never filled in and no Rotten Tomatoes score is ever estimated.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

// lib/*.ts is shared with the app; transpile on the fly (works on Node 20, same as validate-seo.mjs).
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
});
const sel = require(join(ROOT, 'lib/blog/select.ts'));

// Test hooks (used only to exercise this script against a local mock of OMDb; never needed for real runs):
// BLOG_DATA_ROOT re-roots every data/ and public/ path, OMDB_BASE_URL replaces https://www.omdbapi.com/.
const DATA_ROOT = process.env.BLOG_DATA_ROOT ?? ROOT;
const OMDB_BASE = process.env.OMDB_BASE_URL ?? 'https://www.omdbapi.com/';

const RAW_DIR = join(DATA_ROOT, 'data', 'blog', 'source', 'raw');
const WEEKLY_FILE = join(RAW_DIR, 'all-weeks-global.tsv');
const POPULAR_FILE = join(RAW_DIR, 'most-popular.tsv');
const CANDIDATES_FILE = join(DATA_ROOT, 'data', 'blog', 'source', 'netflix-candidates.json');
const OVERRIDES_FILE = join(DATA_ROOT, 'data', 'blog', 'source', 'overrides.json');
const LOOKUPS_FILE = join(DATA_ROOT, 'data', 'blog', 'source', 'omdb-lookups.json');
const RAW_CACHE_FILE = join(DATA_ROOT, 'data', 'blog', 'omdb-raw.json');
const OUT_FILE = join(DATA_ROOT, 'data', 'blog', 'films.json');
const ARTICLES_DIR = join(DATA_ROOT, 'data', 'blog', 'articles');
const DOUBTFUL_FILE = join(DATA_ROOT, 'data', 'blog', 'source', 'doubtful.json');
const PUBLIC_COPY = join(DATA_ROOT, 'public', 'data', 'netflix-top-100.json');

const WEEKLY_URL = 'https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv';
const POPULAR_URL = 'https://www.netflix.com/tudum/top10/data/most-popular.tsv';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const POOL_SIZE = 250;
const TARGET = 100;
const MIN_WEEKLY_ROWS = 10000;
const MIN_POPULAR_FILM_ROWS = 10;
const MAX_REQUESTS = 700;
const DELAY_MS = 400;

const args = new Set(process.argv.slice(2));
const doList = args.has('--list');
const doScores = args.has('--scores');
const refresh = args.has('--refresh');

if (args.has('--help') || (!doList && !doScores)) {
  console.log('Usage: node --env-file=.env.local scripts/blog/refresh.mjs [--list] [--scores] [--refresh]\nSee the comment at the top of this file.');
  process.exit(args.has('--help') ? 0 : 1);
}

const fail = (msg) => {
  console.error(`ABORT: ${msg}\nfilms.json was not written. Caches written so far are kept; re-run to resume.`);
  process.exit(1);
};

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, file);
}
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ list phase

async function loadNetflixFile(path, url) {
  if (existsSync(path)) {
    const buf = readFileSync(path);
    return { buf, downloadedAt: statSync(path).mtime.toISOString(), origin: 'local' };
  }
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/tab-separated-values,*/*' }, signal: AbortSignal.timeout(60000) });
  } catch (e) {
    fail(`Netflix file not found locally (${path}) and the download failed (${e.cause?.code ?? e.name}). Download both TSVs from netflix.com/tudum/top10 into ${RAW_DIR}`);
  }
  if (res.status !== 200) fail(`Netflix download returned HTTP ${res.status} for ${url}; save the file manually into ${RAW_DIR}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(path, buf);
  return { buf, downloadedAt: new Date().toISOString(), origin: 'download' };
}

async function listPhase() {
  const weekly = await loadNetflixFile(WEEKLY_FILE, WEEKLY_URL);
  const popular = await loadNetflixFile(POPULAR_FILE, POPULAR_URL);
  let w, m;
  try {
    w = sel.parseTsv(weekly.buf.toString('utf8'));
    m = sel.parseTsv(popular.buf.toString('utf8'));
    sel.assertHeader(w.header, sel.WEEKLY_HEADER, 'all-weeks-global.tsv');
    sel.assertHeader(m.header, sel.MOST_POPULAR_HEADER, 'most-popular.tsv');
  } catch (e) {
    fail(e.message);
  }
  if (w.rows.length < MIN_WEEKLY_ROWS) fail(`all-weeks-global.tsv has only ${w.rows.length} rows (expected >= ${MIN_WEEKLY_ROWS})`);
  const popularFilms = m.rows.filter((r) => sel.FILM_CATEGORIES.includes(r.category));
  if (popularFilms.length < MIN_POPULAR_FILM_ROWS) fail(`most-popular.tsv has only ${popularFilms.length} film rows`);

  let built;
  try {
    built = sel.buildPool(w.rows, m.rows, POOL_SIZE);
  } catch (e) {
    fail(e.message);
  }
  const out = {
    schemaVersion: 1,
    listSource: 'netflix-download',
    netflix: {
      weeklyUrl: WEEKLY_URL,
      mostPopularUrl: POPULAR_URL,
      downloadedAt: weekly.downloadedAt < popular.downloadedAt ? weekly.downloadedAt : popular.downloadedAt,
      firstWeek: built.firstWeek,
      lastWeek: built.lastWeek,
      weeklySha256: sha256(weekly.buf),
      mostPopularSha256: sha256(popular.buf),
    },
    counts: {
      weeklyRows: w.rows.length,
      mostPopularRows: m.rows.length,
      filmTitles: built.filmTitles,
      tvTitlesSkipped: built.tvTitlesSkipped,
      poolSize: built.pool.length,
    },
    pool: built.pool,
  };
  writeJson(CANDIDATES_FILE, out);
  console.log(
    `List phase: ${built.filmTitles} film titles, ${built.tvTitlesSkipped} TV titles skipped, weeks ${built.firstWeek} to ${built.lastWeek}, pool ${built.pool.length} written to data/blog/source/netflix-candidates.json`,
  );
  return out;
}

// ------------------------------------------------------------------ scores phase

class BudgetStop extends Error {}

async function scoresPhase(candidatesFile, listSource) {
  // A dedicated key for the blog run keeps it off the quota that the extension shares (BLOG_OMDB_API_KEY wins).
  const key = process.env.BLOG_OMDB_API_KEY || process.env.OMDB_API_KEY;
  if (!key) fail('BLOG_OMDB_API_KEY (or OMDB_API_KEY) is not set; run with `node --env-file=.env.local scripts/blog/refresh.mjs ...`');

  const pool = candidatesFile.pool;
  const overrides = readJson(OVERRIDES_FILE, []);
  if (!Array.isArray(overrides)) fail('overrides.json must be an array');
  for (const o of overrides) {
    if (!o.netflixTitle || !/^tt\d+$/.test(o.imdbId ?? '') || !o.reason) fail('overrides.json entries need netflixTitle, imdbId and reason');
  }
  const rawCache = readJson(RAW_CACHE_FILE, {});
  const lookups = readJson(LOOKUPS_FILE, {});
  const previous = readJson(OUT_FILE, null);

  let requests = 0;
  const refreshed = new Set();

  async function call(params) {
    if (requests >= MAX_REQUESTS) throw new BudgetStop(`request budget (${MAX_REQUESTS}) used`);
    requests++;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) qs.set(k, String(v));
    qs.set('apikey', key);
    let res;
    try {
      res = await fetch(`${OMDB_BASE}?${qs}`, { signal: AbortSignal.timeout(20000) });
    } catch (e) {
      fail(`OMDb unreachable (${e.cause?.code ?? e.name})`);
    }
    let data;
    try {
      data = await res.json();
    } catch {
      fail(`OMDb returned a non-JSON body (HTTP ${res.status})`);
    }
    const err = typeof data?.Error === 'string' ? data.Error : '';
    if (/request limit reached/i.test(err)) throw new BudgetStop('OMDb daily quota reached ("Request limit reached")');
    if (/invalid api key/i.test(err)) fail('OMDb rejected the API key ("Invalid API key")');
    if (!res.ok) fail(`OMDb HTTP ${res.status}${err ? `: ${err}` : ''}`);
    await sleep(DELAY_MS);
    return data;
  }

  const isNotFound = (d) => d.Response === 'False' && /not found|too many results/i.test(d.Error ?? '');

  /**
   * Validates and caches a full record. `forTitle` (no identity override): title and Type are compared
   * first, so a junk record that is not the film is a non-match (returns false, not cached) instead of
   * aborting the run; only a matching record with a malformed shape aborts. Without `forTitle` (an
   * identity override) any malformed record aborts.
   */
  function store(record, forTitle) {
    try {
      if (forTitle === undefined) sel.parseOmdb(record);
      else if (!sel.parseCandidateRecord(forTitle, record).ok) {
        console.log(`  ignored a malformed OMDb record that is not "${forTitle}" (${record?.imdbID ?? '?'}: ${String(record?.Title ?? '?').slice(0, 60)})`);
        return false;
      }
    } catch (e) {
      fail(`${e.message} (record ${record?.imdbID ?? '?'})`);
    }
    rawCache[record.imdbID] = { fetchedAt: new Date().toISOString(), data: record };
    refreshed.add(record.imdbID);
    writeJson(RAW_CACHE_FILE, rawCache);
    return true;
  }

  /** Full record by IMDb id: from the cache unless --refresh asks for a fresh one. Null = junk non-match. */
  async function getRecord(imdbId, forTitle) {
    if (rawCache[imdbId] && !(refresh && !refreshed.has(imdbId))) return rawCache[imdbId];
    const data = await call({ i: imdbId, plot: 'short' });
    if (data.Response !== 'True') fail(`OMDb has no record for ${imdbId}: ${data.Error ?? 'unknown error'}`);
    return store(data, forTitle) ? rawCache[imdbId] : null;
  }

  const PRIORITY = { unmatched: 0, 'not-a-movie': 1, 'runtime-mismatch': 2 };
  /** Resolves one candidate to a record that passes the identity checks, or returns the best failure. */
  async function resolve(c) {
    if (c.runtimeConflict) return { ok: false, reason: 'ambiguous-title' };
    let best = { reason: 'unmatched', imdbId: undefined };
    const consider = (res, imdbId) => {
      // an unmatched record is not this film: never carry its id into the excluded list (I7c)
      if (!res.ok && PRIORITY[res.reason] >= PRIORITY[best.reason]) best = { reason: res.reason, imdbId: res.reason === 'unmatched' ? undefined : imdbId };
    };
    const tryRecord = async (imdbId, override) => {
      const entry = await getRecord(imdbId, override ? undefined : c.title);
      if (!entry) return null;
      let parsed;
      if (override) parsed = sel.parseOmdb(entry.data);
      else {
        const r = sel.parseCandidateRecord(c.title, entry.data);
        if (!r.ok) return null;
        parsed = r.parsed;
      }
      const res = sel.evaluateMatch(c, parsed, { override });
      consider(res, imdbId);
      return res.ok ? { ok: true, parsed, fetchedAt: entry.fetchedAt, override: Boolean(override) } : null;
    };

    const override = overrides.find((o) => o.netflixTitle === c.title && (!o.category || o.category === c.category));
    if (override) {
      const hit = await tryRecord(override.imdbId, true);
      return hit ?? { ok: false, reason: best.reason, imdbId: best.imdbId };
    }

    const y = sel.yearOfWeek(c.firstWeek);
    for (const step of sel.lookupPlan(c)) {
      if (step.kind === 't') {
        const lk = `t|${step.title}|${step.year ?? ''}`;
        if (!(lk in lookups)) {
          const data = await call({ t: step.title, type: 'movie', y: step.year, plot: 'short' });
          if (isNotFound(data)) lookups[lk] = { fetchedAt: new Date().toISOString(), imdbId: null };
          else if (data.Response === 'True') {
            const kept = store(data, c.title);
            lookups[lk] = kept
              ? { fetchedAt: new Date().toISOString(), imdbId: data.imdbID }
              : { fetchedAt: new Date().toISOString(), imdbId: null, ignored: String(data.Title ?? '').slice(0, 120) };
          } else fail(`OMDb error for "${c.title}": ${data.Error}`);
          writeJson(LOOKUPS_FILE, lookups);
        }
        if (lookups[lk].imdbId) {
          const hit = await tryRecord(lookups[lk].imdbId, false);
          if (hit) return hit;
        }
      } else {
        const lk = `s|${step.title}`;
        if (!(lk in lookups)) {
          const data = await call({ s: step.title, type: 'movie' });
          if (isNotFound(data)) lookups[lk] = { fetchedAt: new Date().toISOString(), hits: [] };
          else if (data.Response === 'True' && Array.isArray(data.Search)) {
            lookups[lk] = {
              fetchedAt: new Date().toISOString(),
              hits: data.Search.map((h) => ({ imdbId: h.imdbID, title: h.Title, year: Number.parseInt(h.Year, 10), type: h.Type })),
            };
          } else fail(`OMDb search error for "${c.title}": ${data.Error ?? 'unexpected shape'}`);
          writeJson(LOOKUPS_FILE, lookups);
        }
        const hits = lookups[lk].hits
          .filter((h) => h.type === 'movie' && sel.titlesMatch(c.title, h.title) && (y === null || h.year <= y))
          .sort((a, b) => b.year - a.year)
          .slice(0, 2);
        for (const h of hits) {
          const hit = await tryRecord(h.imdbId, false);
          if (hit) return hit;
        }
      }
    }
    return { ok: false, reason: best.reason, imdbId: best.imdbId };
  }

  const eligible = [];
  const excluded = [];
  const doubtful = [];
  const seenIds = new Set();
  let evaluated = 0;
  let stopped = null;

  try {
    for (let i = 0; i < pool.length && eligible.length < TARGET; i++) {
      const c = pool[i];
      const poolRank = i + 1;
      evaluated = poolRank;
      let res;
      try {
        res = await resolve(c);
      } catch (e) {
        if (e instanceof BudgetStop) throw e;
        fail(`${e.message} (pool #${poolRank} "${c.title}")`);
      }
      if (!res.ok) {
        excluded.push(sel.excludedEntry({ netflixTitle: c.title, poolRank, reason: res.reason, imdbId: res.imdbId }));
        console.log(`#${poolRank} ${c.title}: skipped (${res.reason})`);
        continue;
      }
      const id = res.parsed.imdbId;
      const doubt = sel.doubtfulEntry(c, res.parsed);
      const flag = (outcome) => doubt && doubtful.push({ poolRank, ...doubt, override: res.override, outcome });
      if (seenIds.has(id)) {
        flag('duplicate-imdb-id');
        excluded.push({ netflixTitle: c.title, poolRank, reason: 'duplicate-imdb-id', imdbId: id });
        console.log(`#${poolRank} ${c.title}: skipped (duplicate-imdb-id)`);
        continue;
      }
      seenIds.add(id);
      const why = sel.checkEligibility(res.parsed);
      flag(why ?? 'eligible');
      if (why) {
        excluded.push({ netflixTitle: c.title, poolRank, reason: why, imdbId: id });
        console.log(`#${poolRank} ${c.title}: skipped (${why})`);
        continue;
      }
      eligible.push({ candidate: c, poolRank, parsed: res.parsed, fetchedAt: res.fetchedAt });
      console.log(`#${poolRank} ${c.title}: eligible (${eligible.length}/${TARGET})`);
    }
  } catch (e) {
    if (!(e instanceof BudgetStop)) throw e;
    stopped = e.message;
  }

  // C1: every accepted match older than its first chart year, for a human decision (identity override or
  // a reject). Printed and written even when the run stops early.
  writeJson(DOUBTFUL_FILE, {
    note: 'Accepted OMDb matches whose release year is below the first Netflix chart year. A human confirms each one (an identity override in overrides.json) or rejects it. runtimeDeltaMin = OMDb minus Netflix.',
    generatedAt: new Date().toISOString(),
    entries: doubtful,
  });
  for (const d of doubtful) {
    console.log(
      `DOUBTFUL #${d.poolRank} "${d.netflixTitle}" Netflix ${d.netflixYear} vs OMDb "${d.omdbTitle}" ${d.omdbYear} (${d.imdbId}), runtime delta ${d.runtimeDeltaMin === null ? 'n/a' : `${d.runtimeDeltaMin} min`}${d.override ? ', override' : ''}, ${d.outcome}`,
    );
  }
  console.log(`DOUBTFUL matches: ${doubtful.length} (written to data/blog/source/doubtful.json)`);
  console.log(`OMDb requests this run: ${requests}`);
  if (stopped) {
    console.error(
      `STOPPED CLEANLY: ${stopped}. ${eligible.length} of ${TARGET} eligible so far (walked pool #1 to #${evaluated}); ${TARGET - eligible.length} more needed. ` +
        'Caches are saved; re-run later (quota resets daily) to resume. films.json was not written.',
    );
    process.exit(2);
  }
  if (eligible.length < TARGET) fail(`Pool exhausted: only ${eligible.length} of ${TARGET} eligible in ${pool.length} candidates; enlarge POOL_SIZE and re-run --list`);

  // ---- assemble
  const priorFilms = previous?.films ?? [];
  const priorById = new Map(priorFilms.map((f) => [f.omdb.imdbId, f]));
  // slugs never change once used: the previous films.json and every article file (any status) reserve them
  const articleIds = existsSync(ARTICLES_DIR)
    ? readdirSync(ARTICLES_DIR)
        .filter((n) => n.endsWith('.json'))
        .map((n) => {
          try {
            const a = JSON.parse(readFileSync(join(ARTICLES_DIR, n), 'utf8'));
            return { slug: a.slug, imdbId: a.imdbId };
          } catch (e) {
            fail(`cannot read article ${n}: ${e.message}`);
          }
        })
    : [];
  const existingSlugs = sel.existingSlugMap(priorFilms, articleIds);
  const slugs = sel.assignSlugs(
    eligible.map((e) => ({ imdbId: e.parsed.imdbId, title: e.parsed.title, year: e.parsed.year })),
    existingSlugs,
  );
  const today = new Date().toISOString().slice(0, 10);
  const films = eligible.map((e, idx) => {
    const base = {
      candidate: e.candidate,
      poolRank: e.poolRank,
      popularityRank: idx + 1,
      omdb: e.parsed,
      slug: slugs[idx],
      fetchedAt: e.fetchedAt,
      dataChangedAt: e.fetchedAt.slice(0, 10),
    };
    const draft = sel.buildFilmRecord(base);
    const prior = priorById.get(e.parsed.imdbId);
    if (prior) draft.dataChangedAt = sel.filmValuesChanged(prior, draft) ? today : prior.dataChangedAt;
    return draft;
  });

  const nf = candidatesFile.netflix;
  const out = {
    schemaVersion: 1,
    name: 'Top 100 Netflix films with IMDb and Rotten Tomatoes scores',
    description:
      "The 100 films with the most hours viewed in Netflix's published Top 10 data, each with its IMDb rating (0-10) and Rotten Tomatoes Tomatometer (0-100%) as returned by the OMDb API. Gap = RT% minus IMDb x10; positive means critics rated it higher.",
    license: 'Scores belong to IMDb and Rotten Tomatoes via OMDb; popularity data from Netflix',
    selectionRule:
      `Films are ranked by the hours viewed that Netflix publishes: the larger of the total weekly hours across every week of Netflix's global weekly Top 10 (weeks ${nf.firstWeek} to ${nf.lastWeek}) ` +
      `and the hours in the first 91 days from Netflix's Most Popular list. Films are taken in that order until 100 pass four checks against OMDb: the title is a movie, ` +
      `its runtime is within ${sel.RUNTIME_TOLERANCE_MIN} minutes of the runtime Netflix lists (where Netflix lists one), IMDb has a rating from at least ${sel.MIN_VOTES.toLocaleString('en-US')} votes, ` +
      'and a Rotten Tomatoes Tomatometer score is present. Films that fail a check are skipped and listed as popular but not scored. No score is ever estimated.',
    listSource,
    netflix: {
      weeklyUrl: nf.weeklyUrl,
      mostPopularUrl: nf.mostPopularUrl,
      downloadedAt: nf.downloadedAt,
      firstWeek: nf.firstWeek,
      lastWeek: nf.lastWeek,
      weeklySha256: nf.weeklySha256,
      mostPopularSha256: nf.mostPopularSha256,
    },
    generatedAt: new Date().toISOString(),
    counts: {
      filmTitles: candidatesFile.counts.filmTitles,
      tvTitlesSkipped: candidatesFile.counts.tvTitlesSkipped,
      poolEvaluated: evaluated,
      eligible: TARGET,
      excluded: excluded.length,
    },
    films,
    excluded,
  };
  if (new Set(films.map((f) => f.slug)).size !== TARGET) fail('duplicate slugs');
  writeJson(OUT_FILE, out);
  mkdirSync(dirname(PUBLIC_COPY), { recursive: true });
  copyFileSync(OUT_FILE, PUBLIC_COPY);

  const byReason = {};
  for (const x of excluded) byReason[x.reason] = (byReason[x.reason] ?? 0) + 1;
  console.log(`Wrote data/blog/films.json (${films.length} films) and public/data/netflix-top-100.json`);
  console.log(`Evaluated ${evaluated} candidates; excluded ${excluded.length}:`, JSON.stringify(byReason));
}

// ------------------------------------------------------------------ main

let candidatesFile;
let listSource = 'committed-snapshot';
if (doList) {
  candidatesFile = await listPhase();
  listSource = 'netflix-download';
}
if (doScores) {
  if (!candidatesFile) {
    candidatesFile = readJson(CANDIDATES_FILE, null);
    if (!candidatesFile) fail('data/blog/source/netflix-candidates.json is missing; run with --list first');
  }
  await scoresPhase(candidatesFile, listSource);
}
