import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MOST_POPULAR_HEADER,
  WEEKLY_HEADER,
  MIN_VOTES,
  RUNTIME_TOLERANCE_MIN,
  aggregateWeekly,
  assertHeader,
  assignSlugs,
  buildPool,
  checkEligibility,
  evaluateMatch,
  filmValuesChanged,
  lookupPlan,
  mergeMostPopular,
  normTitle,
  parseOmdb,
  parseTsv,
  rankCandidates,
  runtimeMatches,
  slugify,
  stripLanguageTag,
  titlesMatch,
  type Candidate,
  type OmdbParsed,
} from '../../lib/blog/select';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const weekly = parseTsv(fx('weekly-sample.tsv'));
const popular = parseTsv(fx('most-popular-sample.tsv'));

const get = (list: Candidate[], title: string, category = 'Films (English)') => {
  const c = list.find((x) => x.title === title && x.category === category);
  if (!c) throw new Error(`fixture candidate missing: ${title}`);
  return c;
};

describe('parseTsv / assertHeader', () => {
  it('parses header and rows into records', () => {
    expect(weekly.header).toEqual([...WEEKLY_HEADER]);
    expect(weekly.rows).toHaveLength(20);
    expect(weekly.rows[0]).toMatchObject({ week: '2021-11-14', show_title: 'Red Notice', weekly_hours_viewed: '100000000' });
  });

  it('keeps empty cells as empty strings', () => {
    expect(weekly.rows[0].runtime).toBe('');
  });

  it('handles CRLF line endings, a BOM and trailing blank lines', () => {
    const text = '﻿a\tb\r\n1\t2\r\n3\t4\r\n\r\n';
    expect(parseTsv(text)).toEqual({
      header: ['a', 'b'],
      rows: [
        { a: '1', b: '2' },
        { a: '3', b: '4' },
      ],
    });
  });

  it('throws on a ragged row instead of guessing', () => {
    expect(() => parseTsv('a\tb\n1\t2\t3\n')).toThrow(/column/i);
  });

  it('accepts the expected header and rejects any other', () => {
    expect(() => assertHeader(weekly.header, WEEKLY_HEADER, 'weekly')).not.toThrow();
    expect(() => assertHeader(popular.header, MOST_POPULAR_HEADER, 'most-popular')).not.toThrow();
    expect(() => assertHeader(popular.header, WEEKLY_HEADER, 'weekly')).toThrow(/header/i);
  });
});

describe('aggregateWeekly', () => {
  const agg = aggregateWeekly(weekly.rows);

  it('sums hours per title and counts weeks (film categories only)', () => {
    const rn = get(agg.candidates, 'Red Notice');
    expect(rn.weeklyHours).toBe(185_000_000);
    expect(rn.weeksInTop10).toBe(5);
  });

  it('records peak rank (best = lowest number), first and last week', () => {
    const rn = get(agg.candidates, 'Red Notice');
    expect(rn.peakRank).toBe(1);
    expect(rn.firstWeek).toBe('2021-11-14');
    expect(rn.lastWeek).toBe('2021-12-12');
  });

  it('uses the median of usable runtimes (empty, 0 and N/A are ignored) in minutes', () => {
    expect(get(agg.candidates, 'Red Notice').runtimeMin).toBe(118); // 1.9667 h
    expect(get(agg.candidates, 'KPop Demon Hunters').runtimeMin).toBe(100);
  });

  it('leaves runtime null when Netflix never published one (never filled in)', () => {
    expect(get(agg.candidates, 'Glass Onion: A Knives Out Mystery').runtimeMin).toBeNull();
    expect(get(agg.candidates, 'Kantara (Hindi)', 'Films (Non-English)').runtimeMin).toBeNull();
  });

  it('keeps the same title in two film categories as two different candidates', () => {
    const en = get(agg.candidates, 'Alpha', 'Films (English)');
    const non = get(agg.candidates, 'Alpha', 'Films (Non-English)');
    expect(en.weeklyHours).toBe(7_000_000);
    expect(non.weeklyHours).toBe(9_000_000);
  });

  it('flags a title whose usable runtimes differ by more than the tolerance (distinct films merged)', () => {
    expect(get(agg.candidates, 'Dragon').runtimeConflict).toBe(true);
    expect(get(agg.candidates, 'Red Notice').runtimeConflict).toBe(false);
  });

  it('skips TV rows and counts distinct TV titles', () => {
    expect(agg.tvTitlesSkipped).toBe(2);
    expect(agg.candidates.some((c) => c.title === 'Wednesday')).toBe(false);
  });

  it('reports the covered week range and row count', () => {
    expect(agg.firstWeek).toBe('2021-11-14');
    expect(agg.lastWeek).toBe('2025-07-27');
    expect(agg.weeklyRows).toBe(20);
  });

  it('rejects unreadable numbers instead of treating them as zero', () => {
    const bad = [{ ...weekly.rows[0], weekly_hours_viewed: 'lots' }];
    expect(() => aggregateWeekly(bad)).toThrow(/weekly_hours_viewed/);
  });
});

describe('mergeMostPopular (R1: max of weekly sum and first 91 days)', () => {
  const agg = aggregateWeekly(weekly.rows);
  const merged = mergeMostPopular(agg.candidates, popular.rows);

  it('uses first-91-days when it is larger than the weekly sum', () => {
    const rn = get(merged, 'Red Notice');
    expect(rn.popularityHours).toBe(454_200_000);
    expect(rn.hoursSource).toBe('first-91-days');
    expect(rn.mostPopularRank).toBe(2);
    expect(rn.weeksInTop10).toBe(5);
  });

  it('keeps the weekly sum when it is larger', () => {
    const k = get(merged, 'KPop Demon Hunters');
    expect(k.popularityHours).toBe(1_700_000_000);
    expect(k.hoursSource).toBe('weekly-sum');
    expect(k.mostPopularRank).toBe(1);
  });

  it('adds a title that exists only in Most Popular (Bird Box) with no weekly facts', () => {
    const b = get(merged, 'Bird Box');
    expect(b).toMatchObject({
      popularityHours: 325_300_000,
      hoursSource: 'first-91-days',
      weeksInTop10: 0,
      peakRank: null,
      firstWeek: null,
      lastWeek: null,
      mostPopularRank: 6,
      runtimeMin: 124,
    });
  });

  it('falls back to the Most Popular runtime when the weekly file has none', () => {
    const rows = [{ ...popular.rows[0], show_title: 'Glass Onion: A Knives Out Mystery', runtime: '2.2333' }];
    const m = mergeMostPopular(agg.candidates, rows);
    expect(get(m, 'Glass Onion: A Knives Out Mystery').runtimeMin).toBe(134);
  });

  it('ignores TV rows in Most Popular', () => {
    expect(merged.some((c) => c.title === 'Wednesday')).toBe(false);
  });

  it('does not mutate its input', () => {
    expect(get(agg.candidates, 'Red Notice').popularityHours).toBe(185_000_000);
  });
});

describe('rankCandidates', () => {
  const agg = aggregateWeekly(weekly.rows);
  const ranked = rankCandidates(mergeMostPopular(agg.candidates, popular.rows));

  it('orders by popularityHours descending', () => {
    expect(ranked[0].title).toBe('KPop Demon Hunters');
    expect(ranked[1].title).toBe('Red Notice');
    expect(ranked[2].title).toBe('Bird Box');
  });

  it('breaks ties by weeks in Top 10 (desc), then by title', () => {
    const tied = ranked.filter((c) => c.popularityHours === 10_000_000).map((c) => c.title);
    expect(tied).toEqual(['B Film', 'A Film', 'C Film']);
  });

  it('is stable and sorted without mutating the input', () => {
    const copy = [...agg.candidates];
    rankCandidates(agg.candidates);
    expect(agg.candidates).toEqual(copy);
  });
});

describe('buildPool', () => {
  it('returns the top N candidates plus counts and the Netflix date range', () => {
    const pool = buildPool(weekly.rows, popular.rows, 3);
    expect(pool.pool.map((c) => c.title)).toEqual(['KPop Demon Hunters', 'Red Notice', 'Bird Box']);
    expect(pool.filmTitles).toBe(11);
    expect(pool.tvTitlesSkipped).toBe(2);
    expect(pool.firstWeek).toBe('2021-11-14');
    expect(pool.lastWeek).toBe('2025-07-27');
  });
});

describe('title normalisation and matching', () => {
  it('lowercases, removes accents, apostrophes and punctuation, maps & to and', () => {
    expect(normTitle('Guillermo del Toro’s Pinocchio')).toBe('guillermo del toros pinocchio');
    expect(normTitle("Don't Look Up")).toBe('dont look up');
    expect(normTitle('Fast & Furious')).toBe('fast and furious');
    expect(normTitle('AMÉLIE')).toBe('amelie');
    expect(normTitle('Spider-Man: Into the Spider-Verse')).toBe('spider man into the spider verse');
  });

  it('treats em dash, en dash and colon part-title forms as equal', () => {
    expect(titlesMatch('Rebel Moon — Part One: A Child of Fire', 'Rebel Moon: Part One – A Child of Fire')).toBe(true);
  });

  it('strips only a trailing language tag', () => {
    expect(stripLanguageTag('RRR (Hindi)')).toBe('RRR');
    expect(stripLanguageTag('Kantara (Hindi)')).toBe('Kantara');
    expect(stripLanguageTag('Heat (1995)')).toBe('Heat (1995)');
    expect(stripLanguageTag('(Hindi) Something')).toBe('(Hindi) Something');
  });

  it('matches a Netflix title with a language tag to the plain OMDb title', () => {
    expect(titlesMatch('RRR (Hindi)', 'RRR')).toBe(true);
  });

  it('does not match different films', () => {
    expect(titlesMatch('Hustle', 'Hustlers')).toBe(false);
    expect(titlesMatch('The Mother', 'Mother')).toBe(false);
  });
});

describe('runtimeMatches', () => {
  it('accepts a difference of exactly the tolerance and rejects more', () => {
    expect(RUNTIME_TOLERANCE_MIN).toBe(12);
    expect(runtimeMatches(118, 130)).toBe(true);
    expect(runtimeMatches(118, 106)).toBe(true);
    expect(runtimeMatches(118, 131)).toBe(false);
    expect(runtimeMatches(118, 105)).toBe(false);
  });

  it('cannot match when OMDb has no runtime', () => {
    expect(runtimeMatches(118, null)).toBe(false);
  });
});

describe('lookupPlan', () => {
  const base = { title: 'Red Notice', firstWeek: '2021-11-14' };

  it('tries first-week year, the year before, no year, then search', () => {
    expect(lookupPlan(base)).toEqual([
      { kind: 't', title: 'Red Notice', year: 2021 },
      { kind: 't', title: 'Red Notice', year: 2020 },
      { kind: 't', title: 'Red Notice', year: null },
      { kind: 's', title: 'Red Notice' },
    ]);
  });

  it('skips year steps when there is no first week (Bird Box)', () => {
    expect(lookupPlan({ title: 'Bird Box', firstWeek: null })).toEqual([
      { kind: 't', title: 'Bird Box', year: null },
      { kind: 's', title: 'Bird Box' },
    ]);
  });

  it('queries without the language tag', () => {
    expect(lookupPlan({ title: 'RRR (Hindi)', firstWeek: '2022-06-12' })[0]).toEqual({ kind: 't', title: 'RRR', year: 2022 });
  });
});

const rawOmdb = (over: Record<string, unknown> = {}) => ({
  Title: 'Red Notice',
  Year: '2021',
  Rated: 'PG-13',
  Released: '12 Nov 2021',
  Runtime: '118 min',
  Genre: 'Action, Comedy, Thriller',
  Director: 'Rawson Marshall Thurber',
  Writer: 'Rawson Marshall Thurber',
  Actors: 'Dwayne Johnson, Ryan Reynolds, Gal Gadot',
  Plot: 'An Interpol agent tracks the world’s most wanted art thief.',
  Language: 'English, Spanish',
  Country: 'United States',
  Awards: '2 nominations total',
  Ratings: [
    { Source: 'Internet Movie Database', Value: '6.3/10' },
    { Source: 'Rotten Tomatoes', Value: '36%' },
    { Source: 'Metacritic', Value: '37/100' },
  ],
  Metascore: '37',
  imdbRating: '6.3',
  imdbVotes: '361,059',
  imdbID: 'tt7991608',
  Type: 'movie',
  Response: 'True',
  ...over,
});

describe('parseOmdb', () => {
  it('maps a full record', () => {
    expect(parseOmdb(rawOmdb())).toEqual({
      imdbId: 'tt7991608',
      title: 'Red Notice',
      year: 2021,
      type: 'movie',
      rated: 'PG-13',
      released: '2021-11-12',
      runtimeMin: 118,
      genres: ['Action', 'Comedy', 'Thriller'],
      directors: ['Rawson Marshall Thurber'],
      writers: ['Rawson Marshall Thurber'],
      actors: ['Dwayne Johnson', 'Ryan Reynolds', 'Gal Gadot'],
      plot: 'An Interpol agent tracks the world’s most wanted art thief.',
      languages: ['English', 'Spanish'],
      countries: ['United States'],
      awards: '2 nominations total',
      metascore: 37,
      imdbRating: 6.3,
      imdbVotes: 361059,
      rtPercent: 36,
    });
  });

  it('turns N/A into null and never invents a value', () => {
    const p = parseOmdb(
      rawOmdb({
        Rated: 'N/A',
        Released: 'N/A',
        Plot: 'N/A',
        Awards: 'N/A',
        Metascore: 'N/A',
        imdbRating: 'N/A',
        imdbVotes: 'N/A',
        Runtime: 'N/A',
        Ratings: [],
      }),
    );
    expect(p).toMatchObject({
      rated: null,
      released: null,
      plot: null,
      awards: null,
      metascore: null,
      imdbRating: null,
      imdbVotes: null,
      runtimeMin: null,
      rtPercent: null,
    });
  });

  it('strips role annotations from writer credits and de-duplicates', () => {
    const p = parseOmdb(rawOmdb({ Writer: 'Jane Roe (screenplay), John Doe (story by), Jane Roe (novel)' }));
    expect(p.writers).toEqual(['Jane Roe', 'John Doe']);
  });

  it('reads hour-and-minute runtimes', () => {
    expect(parseOmdb(rawOmdb({ Runtime: '2 h 5 min' })).runtimeMin).toBe(125);
  });

  it('throws on a record that does not look like OMDb (schema mismatch)', () => {
    expect(() => parseOmdb({ Response: 'True', Title: 'x' })).toThrow(/schema/i);
    expect(() => parseOmdb(rawOmdb({ imdbID: 'nope' }))).toThrow(/schema/i);
    expect(() => parseOmdb(rawOmdb({ Ratings: 'x' }))).toThrow(/schema/i);
    expect(() => parseOmdb(rawOmdb({ Released: 'sometime' }))).toThrow(/schema/i);
  });
});

describe('evaluateMatch', () => {
  const cand = (over: Partial<Candidate> = {}): Candidate => ({
    title: 'Red Notice',
    category: 'Films (English)',
    popularityHours: 1,
    weeklyHours: 1,
    hoursSource: 'weekly-sum',
    weeksInTop10: 1,
    peakRank: 1,
    firstWeek: '2021-11-14',
    lastWeek: '2021-11-14',
    mostPopularRank: null,
    runtimeMin: 118,
    runtimeConflict: false,
    ...over,
  });
  const omdb = (over: Record<string, unknown> = {}): OmdbParsed => parseOmdb(rawOmdb(over));

  it('accepts title, movie type, year and runtime that all agree', () => {
    expect(evaluateMatch(cand(), omdb())).toEqual({ ok: true });
  });

  it('rejects a different title as unmatched', () => {
    expect(evaluateMatch(cand(), omdb({ Title: 'Red Notice 2' }))).toEqual({ ok: false, reason: 'unmatched' });
  });

  it('accepts a different title only through an identity override', () => {
    expect(evaluateMatch(cand(), omdb({ Title: 'Red Notice 2' }), { override: true })).toEqual({ ok: true });
  });

  it('rejects a film released after the first Netflix chart week', () => {
    expect(evaluateMatch(cand(), omdb({ Year: '2022' }))).toEqual({ ok: false, reason: 'unmatched' });
  });

  it('accepts an old licensed film far from its first chart week', () => {
    const c = cand({ title: 'Shrek', firstWeek: '2022-03-06', runtimeMin: 90 });
    expect(evaluateMatch(c, omdb({ Title: 'Shrek', Year: '2001', Runtime: '90 min' }))).toEqual({ ok: true });
  });

  it('flags a series with the same title as not-a-movie', () => {
    expect(evaluateMatch(cand(), omdb({ Type: 'series' }))).toEqual({ ok: false, reason: 'not-a-movie' });
  });

  it('flags a runtime more than 12 minutes off as runtime-mismatch', () => {
    expect(evaluateMatch(cand(), omdb({ Runtime: '131 min' }))).toEqual({ ok: false, reason: 'runtime-mismatch' });
    expect(evaluateMatch(cand(), omdb({ Runtime: '130 min' }))).toEqual({ ok: true });
  });

  it('treats a missing OMDb runtime as runtime-mismatch (cannot verify)', () => {
    expect(evaluateMatch(cand(), omdb({ Runtime: 'N/A' }))).toEqual({ ok: false, reason: 'runtime-mismatch' });
  });

  it('when Netflix has no runtime, skips the runtime check but requires a feature-length OMDb runtime', () => {
    const c = cand({ runtimeMin: null });
    expect(evaluateMatch(c, omdb({ Runtime: '95 min' }))).toEqual({ ok: true });
    expect(evaluateMatch(c, omdb({ Runtime: '12 min' }))).toEqual({ ok: false, reason: 'runtime-mismatch' });
  });

  it('when Netflix has no runtime, only accepts a release year in the first chart year or the year before', () => {
    const c = cand({ runtimeMin: null });
    expect(evaluateMatch(c, omdb({ Year: '2020' }))).toEqual({ ok: true });
    expect(evaluateMatch(c, omdb({ Year: '2015' }))).toEqual({ ok: false, reason: 'unmatched' });
    expect(evaluateMatch(c, omdb({ Year: '2015' }), { override: true })).toEqual({ ok: true });
  });

  it('skips the first-week-year check for a title that has no first week (Bird Box)', () => {
    const c = cand({ title: 'Bird Box', firstWeek: null, runtimeMin: 124 });
    expect(evaluateMatch(c, omdb({ Title: 'Bird Box', Year: '2018', Runtime: '124 min' }))).toEqual({ ok: true });
  });
});

describe('checkEligibility (R2)', () => {
  const ok = parseOmdb(rawOmdb());

  it('passes a complete record', () => {
    expect(MIN_VOTES).toBe(5000);
    expect(checkEligibility(ok)).toBeNull();
  });

  it('reports each missing piece with its own reason', () => {
    expect(checkEligibility(parseOmdb(rawOmdb({ imdbRating: 'N/A' })))).toBe('no-imdb-rating');
    expect(checkEligibility(parseOmdb(rawOmdb({ imdbVotes: '4,999' })))).toBe('low-votes');
    expect(checkEligibility(parseOmdb(rawOmdb({ imdbVotes: 'N/A' })))).toBe('low-votes');
    expect(checkEligibility(parseOmdb(rawOmdb({ Ratings: [{ Source: 'Internet Movie Database', Value: '6.3/10' }] })))).toBe('no-rt-score');
  });

  it('accepts exactly 5,000 votes', () => {
    expect(checkEligibility(parseOmdb(rawOmdb({ imdbVotes: '5,000' })))).toBeNull();
  });

  it('checks the IMDb rating before votes before RT', () => {
    expect(checkEligibility(parseOmdb(rawOmdb({ imdbRating: 'N/A', imdbVotes: '10', Ratings: [] })))).toBe('no-imdb-rating');
    expect(checkEligibility(parseOmdb(rawOmdb({ imdbVotes: '10', Ratings: [] })))).toBe('low-votes');
  });
});

describe('slugify (spec 4.2)', () => {
  it('lowercases, drops apostrophes, maps & to and, hyphenates and appends the year', () => {
    expect(slugify('Red Notice', 2021)).toBe('red-notice-2021');
    expect(slugify("Don't Look Up", 2021)).toBe('dont-look-up-2021');
    expect(slugify('Guillermo del Toro’s Pinocchio', 2022)).toBe('guillermo-del-toros-pinocchio-2022');
    expect(slugify('Fast & Furious', 2009)).toBe('fast-and-furious-2009');
  });

  it('strips diacritics and collapses punctuation runs', () => {
    expect(slugify('Amélie: The Film!!', 2001)).toBe('amelie-the-film-2001');
    expect(slugify('Spider-Man: Into the Spider-Verse', 2018)).toBe('spider-man-into-the-spider-verse-2018');
  });

  it('cuts the title part at a word boundary to at most 50 characters', () => {
    const slug = slugify('Fast & Furious Presents: Hobbs & Shaw Returns With A Very Long Subtitle', 2019);
    const base = slug.replace(/-2019$/, '');
    expect(base.length).toBeLessThanOrEqual(50);
    expect(base).toBe('fast-and-furious-presents-hobbs-and-shaw-returns');
    expect(slug.endsWith('-2019')).toBe(true);
  });

  it('keeps a title that is exactly 50 characters', () => {
    const t = 'abcdefghi '.repeat(5).trim(); // 49 chars
    expect(slugify(t, 2020).replace(/-2020$/, '').length).toBe(49);
  });

  it('hard-cuts a single word longer than 50 characters', () => {
    const slug = slugify('x'.repeat(80), 2020);
    expect(slug).toBe(`${'x'.repeat(50)}-2020`);
  });

  it('always matches the slug pattern, even for a title with no latin letters', () => {
    const re = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const t of ['Red Notice', '!!!', 'アニメ', '  -- A -- ']) {
      expect(slugify(t, 2021)).toMatch(re);
    }
  });
});

describe('assignSlugs', () => {
  const items = [
    { imdbId: 'tt1', title: 'Hustle', year: 2022 },
    { imdbId: 'tt2', title: 'Hustle', year: 2022 },
    { imdbId: 'tt3', title: 'Kate', year: 2021 },
  ];

  it('keeps the plain slug for the first (most popular) film and suffixes the imdbId on a collision', () => {
    expect(assignSlugs(items)).toEqual(['hustle-2022', 'hustle-2022-tt2', 'kate-2021']);
  });

  it('reuses an existing slug for the same imdbId so slugs never change', () => {
    expect(assignSlugs(items, { tt3: 'kate-the-film-2021' })).toEqual(['hustle-2022', 'hustle-2022-tt2', 'kate-the-film-2021']);
  });
});

describe('filmValuesChanged', () => {
  const film = (over: Record<string, unknown> = {}) => ({
    omdb: { imdbRating: 6.3, rtPercent: 36, imdbVotes: 100000 },
    netflix: { popularityHours: 1, weeksInTop10: 1, peakRank: 1, mostPopularRank: null },
    fetchedAt: 'a',
    dataChangedAt: 'b',
    ...over,
  });

  it('ignores fetchedAt and dataChangedAt', () => {
    expect(filmValuesChanged(film(), film({ fetchedAt: 'z', dataChangedAt: 'y' }))).toBe(false);
  });

  it('detects a changed displayed value', () => {
    expect(filmValuesChanged(film(), film({ omdb: { imdbRating: 6.4, rtPercent: 36, imdbVotes: 100000 } }))).toBe(true);
  });
});
