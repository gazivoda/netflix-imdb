// Combined-review fixes for the data pipeline (C1 same-title older film, I7 query
// sanitising, junk records, excluded ids, slug seeding). Netflix runtimes and first
// weeks below are the real values from data/blog/source/netflix-candidates.json; OMDb
// years and runtimes are those of the same-title older films the reviewer found.
import {
  OLD_FILM_RUNTIME_TOLERANCE_MIN,
  assignSlugs,
  doubtfulEntry,
  evaluateMatch,
  excludedEntry,
  existingSlugMap,
  lookupPlan,
  parseCandidateRecord,
  parseOmdb,
  sanitiseQuery,
  type Candidate,
  type OmdbParsed,
} from '../../lib/blog/select';

const raw = (over: Record<string, unknown> = {}) => ({
  Title: 'Red Notice',
  Year: '2021',
  Rated: 'PG-13',
  Released: '12 Nov 2021',
  Runtime: '118 min',
  Genre: 'Action',
  Director: 'A Director',
  Writer: 'A Writer',
  Actors: 'A One, B Two',
  Plot: 'A plot.',
  Language: 'English',
  Country: 'United States',
  Awards: 'N/A',
  Ratings: [{ Source: 'Rotten Tomatoes', Value: '36%' }],
  Metascore: 'N/A',
  imdbRating: '6.3',
  imdbVotes: '361,059',
  imdbID: 'tt7991608',
  Type: 'movie',
  Response: 'True',
  ...over,
});
const omdb = (title: string, year: number, runtime: number | null): OmdbParsed =>
  parseOmdb(raw({ Title: title, Year: String(year), Runtime: runtime === null ? 'N/A' : `${runtime} min` }));
const cand = (title: string, firstWeek: string | null, runtimeMin: number | null): Candidate => ({
  title,
  category: 'Films (English)',
  popularityHours: 1,
  weeklyHours: 1,
  hoursSource: 'weekly-sum',
  weeksInTop10: 1,
  peakRank: 1,
  firstWeek,
  lastWeek: firstWeek,
  mostPopularRank: null,
  runtimeMin,
  runtimeConflict: false,
});

describe('C1: a same-title older film needs a near-exact runtime', () => {
  it('uses a 3-minute tolerance for films older than the year before the first chart week', () => {
    expect(OLD_FILM_RUNTIME_TOLERANCE_MIN).toBe(3);
  });

  // [Netflix title, first chart week, Netflix runtime, OMDb year, OMDb runtime]
  const rejected: [string, string, number, number, number][] = [
    ['Troll 2', '2025-12-07', 105, 1990, 95],
    ['The Mother', '2023-05-14', 117, 2003, 112],
    ['The Killer', '2023-11-12', 120, 1989, 111],
    ['Brick', '2025-07-13', 101, 2005, 110],
    ['Goat', '2026-05-17', 100, 2016, 96],
    ['The Crash', '2026-05-17', 95, 2017, 85],
  ];
  it.each(rejected)('rejects %s (Netflix %s) against the %d-minute older film', (title, week, nfRt, year, omdbRt) => {
    expect(evaluateMatch(cand(title, week, nfRt), omdb(title, year, omdbRt))).toEqual({ ok: false, reason: 'unmatched' });
  });

  it('rejects the older film when the delta is 4 minutes, accepts at 3 (boundary)', () => {
    expect(evaluateMatch(cand('Damsel', '2024-03-10', 110), omdb('Damsel', 2018, 114)).ok).toBe(false);
    expect(evaluateMatch(cand('Damsel', '2024-03-10', 110), omdb('Damsel', 2018, 106)).ok).toBe(false);
    expect(evaluateMatch(cand('Damsel', '2024-03-10', 110), omdb('Damsel', 2018, 113)).ok).toBe(true);
  });

  it('rejects an older film when Netflix published no runtime (no override)', () => {
    expect(evaluateMatch(cand('Murder Mystery', '2023-03-26', null), omdb('Murder Mystery', 2019, 97))).toEqual({
      ok: false,
      reason: 'unmatched',
    });
  });

  it('still accepts licensed catalogue films with exact runtimes', () => {
    expect(evaluateMatch(cand('Shrek', '2022-03-06', 90), omdb('Shrek', 2001, 90))).toEqual({ ok: true });
    expect(evaluateMatch(cand('Despicable Me', '2022-02-06', 95), omdb('Despicable Me', 2010, 95))).toEqual({ ok: true });
  });

  it('keeps the 12-minute tolerance for the first chart year and the year before (ruling B6 window)', () => {
    expect(evaluateMatch(cand('Damsel', '2024-03-10', 110), omdb('Damsel', 2024, 120)).ok).toBe(true);
    expect(evaluateMatch(cand('Damsel', '2024-03-10', 110), omdb('Damsel', 2023, 121)).ok).toBe(true);
  });

  it('an identity override waives the stricter old-film tolerance', () => {
    expect(evaluateMatch(cand('Troll 2', '2025-12-07', 105), omdb('Troll 2', 1990, 95), { override: true })).toEqual({ ok: true });
  });

  it('Apex (95 vs 94) and Damsel (110 vs 113) pass the runtime rule, so they must be reported as DOUBTFUL', () => {
    const apexC = cand('Apex', '2026-04-26', 95);
    const apexO = omdb('Apex', 2021, 94);
    expect(evaluateMatch(apexC, apexO).ok).toBe(true);
    expect(doubtfulEntry(apexC, apexO)).toEqual({
      netflixTitle: 'Apex',
      netflixFirstWeek: '2026-04-26',
      netflixYear: 2026,
      omdbTitle: 'Apex',
      omdbYear: 2021,
      imdbId: 'tt7991608',
      netflixRuntimeMin: 95,
      omdbRuntimeMin: 94,
      runtimeDeltaMin: -1,
    });
    expect(doubtfulEntry(cand('Damsel', '2024-03-10', 110), omdb('Damsel', 2018, 113))?.runtimeDeltaMin).toBe(3);
  });
});

describe('doubtfulEntry', () => {
  it('lists any OMDb year below the first chart year, including the year before', () => {
    expect(doubtfulEntry(cand('Red Notice', '2022-01-02', 118), omdb('Red Notice', 2021, 118))?.omdbYear).toBe(2021);
  });
  it('returns null for the first chart year and for a title with no first week', () => {
    expect(doubtfulEntry(cand('Red Notice', '2021-11-14', 118), omdb('Red Notice', 2021, 118))).toBeNull();
    expect(doubtfulEntry(cand('Bird Box', null, 124), omdb('Bird Box', 2018, 124))).toBeNull();
  });
  it('reports a null runtime delta when either runtime is missing', () => {
    expect(doubtfulEntry(cand('Red Notice', '2022-01-02', null), omdb('Red Notice', 2021, 118))?.runtimeDeltaMin).toBeNull();
  });
});

describe('I7a: sanitiseQuery', () => {
  it('maps a spaced em dash to " - "', () => {
    expect(sanitiseQuery('Rebel Moon — Part One: A Child of Fire')).toBe('Rebel Moon - Part One: A Child of Fire');
    expect(sanitiseQuery('Rebel Moon — Part Two: The Scargiver')).toBe('Rebel Moon - Part Two: The Scargiver');
  });
  it('maps a spaced en dash to " - "', () => {
    expect(sanitiseQuery('Fear Street – 1994')).toBe('Fear Street - 1994');
  });
  it('maps curly apostrophes and quotes to ASCII', () => {
    expect(sanitiseQuery('Guillermo del Toro’s Pinocchio')).toBe("Guillermo del Toro's Pinocchio");
    expect(sanitiseQuery('Madea’s Destination Wedding')).toBe("Madea's Destination Wedding");
    expect(sanitiseQuery('The “Real” One')).toBe('The "Real" One');
  });
  it('leaves an ASCII title alone', () => {
    expect(sanitiseQuery("Madea's Destination Wedding")).toBe("Madea's Destination Wedding");
  });
  it('lookupPlan sends sanitised queries in every step', () => {
    const steps = lookupPlan({ title: 'Guillermo del Toro’s Pinocchio', firstWeek: '2022-12-11' });
    expect(steps.every((s) => s.title === "Guillermo del Toro's Pinocchio")).toBe(true);
    expect(lookupPlan({ title: 'Rebel Moon — Part One: A Child of Fire', firstWeek: '2023-12-24' })[0].title).toBe(
      'Rebel Moon - Part One: A Child of Fire',
    );
  });
});

describe('I7b: parseCandidateRecord (one junk record must not abort the run)', () => {
  it('parses a matching movie record', () => {
    const r = parseCandidateRecord('Red Notice', raw());
    expect(r.ok && r.parsed.imdbId).toBe('tt7991608');
  });
  it('treats a malformed record with a different title as a non-match instead of throwing', () => {
    const junk = raw({ Title: 'Netflix: The Glass Onion Cast Reacts to the Trailer', Released: 'sometime', Runtime: '3 minutes' });
    expect(parseCandidateRecord('Glass Onion: A Knives Out Mystery', junk)).toEqual({
      ok: false,
      junk: expect.stringMatching(/schema/i),
    });
  });
  it('treats a malformed non-movie record with the same title as a non-match', () => {
    expect(parseCandidateRecord('Red Notice', raw({ Type: 'episode', Released: 'sometime' })).ok).toBe(false);
  });
  it('treats a record without a Title as a non-match', () => {
    expect(parseCandidateRecord('Red Notice', { Response: 'True' }).ok).toBe(false);
  });
  it('still parses a well-formed non-matching record (so evaluateMatch can give the reason)', () => {
    const r = parseCandidateRecord('Red Notice', raw({ Title: 'Red Notice 2' }));
    expect(r.ok).toBe(true);
  });
  it('throws (aborts) on a malformed record whose title and type match', () => {
    expect(() => parseCandidateRecord('Red Notice', raw({ Released: 'sometime' }))).toThrow(/schema/i);
  });
});

describe('I7c: excludedEntry', () => {
  it('never attaches an imdbId to an unmatched or ambiguous entry', () => {
    expect(excludedEntry({ netflixTitle: 'Apex', poolRank: 3, reason: 'unmatched', imdbId: 'tt1' })).toEqual({
      netflixTitle: 'Apex',
      poolRank: 3,
      reason: 'unmatched',
    });
    expect(excludedEntry({ netflixTitle: 'Alpha', poolRank: 4, reason: 'ambiguous-title', imdbId: 'tt1' })).not.toHaveProperty('imdbId');
  });
  it('keeps the imdbId for reasons where the record is the film', () => {
    expect(excludedEntry({ netflixTitle: 'X', poolRank: 5, reason: 'low-votes', imdbId: 'tt2' })).toEqual({
      netflixTitle: 'X',
      poolRank: 5,
      reason: 'low-votes',
      imdbId: 'tt2',
    });
    expect(excludedEntry({ netflixTitle: 'X', poolRank: 5, reason: 'runtime-mismatch' })).not.toHaveProperty('imdbId');
  });
});

describe('I7d: slugs are seeded from articles as well as the previous films.json', () => {
  it('merges article files (any status) over the previous films.json', () => {
    const articles = [
      { slug: 'kate-2021', imdbId: 'tt3', status: 'draft' },
      { slug: 'old-film-2019', imdbId: 'tt9', status: 'published' },
    ];
    const map = existingSlugMap([{ slug: 'hustle-2022', omdb: { imdbId: 'tt1' } }], articles);
    expect(map).toEqual({ tt1: 'hustle-2022', tt3: 'kate-2021', tt9: 'old-film-2019' });
  });

  it('a published film that dropped out of the 100 keeps its slug reserved', () => {
    // tt9 published as hustle-2022, is no longer in the list; a new film with the same title must not take the slug
    const slugs = assignSlugs([{ imdbId: 'tt5', title: 'Hustle', year: 2022 }], { tt9: 'hustle-2022' });
    expect(slugs).toEqual(['hustle-2022-tt5']);
  });
});
