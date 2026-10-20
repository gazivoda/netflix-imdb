// Article file schema (spec 3.1): shape, lengths, required sections, status and
// review consistency. Returns findings instead of throwing so a writer sees every
// problem in one run. Pure functions, no I/O.

import { isIsoDate } from './format';
import { issue, type Issue } from './issue';
import type { FilmStats } from './stats';
import { countWords } from './similarity';
import { generatedTitle, isRecognisableShortTitle, MAX_SHORT_TITLE_LENGTH } from './title';
import { renderTokens } from './tokens';
import { directionProblems } from './wording';
import { filmNames, maskedSentences, namesFilm as namesFilmIn, TITLE_MASK } from './sentences';
import type { Article, Film } from './types';

export const REQUIRED_SECTIONS = ['why-split', 'the-film', 'who-it-suits'] as const;
export const OPTIONAL_SECTIONS = ['more', 'data-note'] as const;

/** Word budgets per section id (inclusive). */
export const SECTION_WORDS: Record<string, [number, number]> = {
  'why-split': [150, 260],
  'the-film': [80, 160],
  'who-it-suits': [80, 160],
  more: [0, 150],
  'data-note': [1, 120],
};

export const FIELD_LIMITS = {
  h1: [30, 90],
  description: [120, 158],
  summaryWords: [45, 75],
  heading: [20, 80],
  faqItems: [2, 3],
  faqQ: [25, 100],
  faqAWords: [35, 90],
  sources: 6,
  supports: 200,
  related: 2,
} as const;

const TOP_KEYS = [
  'schemaVersion',
  'slug',
  'imdbId',
  'status',
  'published',
  'contentUpdated',
  'shortTitle',
  'h1',
  'description',
  'summary',
  'sections',
  'faq',
  'sources',
  'related',
  'review',
];
const STATUSES = ['draft', 'review', 'checked', 'published'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SchemaContext {
  /** The film with article.slug; omitted when it does not exist. */
  film?: Film;
  stats?: FilmStats;
  /** File name (for example "red-notice-2021.json") to check against the slug. */
  fileName?: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/** R15: abs(gap) >= 30 or fewer than 25,000 IMDb votes need a hand check of the RT page. */
export const r15Required = (film: Film, stats: Pick<FilmStats, 'absGap'>): boolean =>
  stats.absGap >= 30 || film.omdb.imdbVotes < 25_000;

/** Outcome an RT hand check must have (R15): 0-2 points match, 3-9 note, 10+ hold. */
export const expectedRtOutcome = (rtSite: number, rtOmdb: number): 'match' | 'note' | 'hold' => {
  const d = Math.abs(rtSite - rtOmdb);
  return d <= 2 ? 'match' : d <= 9 ? 'note' : 'hold';
};

function checkKeys(o: Obj, allowed: string[], where: string, out: Issue[]): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) out.push(issue('unknown-key', `unknown key "${k}"`, where));
}

/** Pure shape check. Any finding here means the semantic checks cannot run. */
function structure(raw: unknown): Issue[] {
  const out: Issue[] = [];
  const bad = (msg: string, where: string): void => void out.push(issue('type', msg, where));
  if (!isObj(raw)) return [issue('type', 'article must be a JSON object')];
  checkKeys(raw, TOP_KEYS, '', out);
  if (raw.schemaVersion !== 1) bad('schemaVersion must be 1', 'schemaVersion');
  for (const k of ['slug', 'imdbId', 'contentUpdated', 'h1', 'description', 'summary']) {
    if (!isStr(raw[k])) bad(`${k} must be a string`, k);
  }
  if (!isStr(raw.status)) bad('status must be a string', 'status');
  if (raw.published !== null && !isStr(raw.published)) bad('published must be a date string or null', 'published');
  if (raw.shortTitle !== undefined && !isStr(raw.shortTitle)) bad('shortTitle must be a string', 'shortTitle');

  if (!Array.isArray(raw.sections)) bad('sections must be an array', 'sections');
  else {
    raw.sections.forEach((s, i) => {
      const w = `sections[${i}]`;
      if (!isObj(s)) return bad('section must be an object', w);
      checkKeys(s, ['id', 'heading', 'paragraphs'], w, out);
      if (!isStr(s.id) || !isStr(s.heading)) bad('section needs string id and heading', w);
      if (!Array.isArray(s.paragraphs) || !s.paragraphs.every(isStr)) bad('paragraphs must be an array of strings', w);
    });
  }
  if (!Array.isArray(raw.faq)) bad('faq must be an array', 'faq');
  else {
    raw.faq.forEach((f, i) => {
      const w = `faq[${i}]`;
      if (!isObj(f)) return bad('faq item must be an object', w);
      checkKeys(f, ['q', 'a'], w, out);
      if (!isStr(f.q) || !isStr(f.a)) bad('faq item needs string q and a', w);
    });
  }
  if (!Array.isArray(raw.sources)) bad('sources must be an array', 'sources');
  else {
    raw.sources.forEach((s, i) => {
      const w = `sources[${i}]`;
      if (!isObj(s)) return bad('source must be an object', w);
      checkKeys(s, ['id', 'url', 'title', 'publisher', 'accessed', 'supports'], w, out);
      for (const k of ['id', 'url', 'title', 'publisher', 'accessed', 'supports']) {
        if (!isStr(s[k])) bad(`source.${k} must be a string`, w);
      }
    });
  }
  if (raw.related !== undefined) {
    if (!Array.isArray(raw.related)) bad('related must be an array', 'related');
    else {
      raw.related.forEach((r, i) => {
        const w = `related[${i}]`;
        if (!isObj(r)) return bad('related item must be an object', w);
        checkKeys(r, ['slug', 'reason'], w, out);
        if (!isStr(r.slug) || !isStr(r.reason)) bad('related item needs string slug and reason', w);
      });
    }
  }
  const rv = raw.review;
  if (!isObj(rv)) bad('review must be an object', 'review');
  else {
    checkKeys(rv, ['writer', 'writtenOn', 'factChecker', 'factCheckedOn', 'cuts', 'rtCheck'], 'review', out);
    if (!isStr(rv.writer) || !isStr(rv.writtenOn)) bad('review.writer and review.writtenOn must be strings', 'review');
    for (const k of ['factChecker', 'factCheckedOn']) {
      if (rv[k] !== null && !isStr(rv[k])) bad(`review.${k} must be a string or null`, 'review');
    }
    if (!Array.isArray(rv.cuts) || !rv.cuts.every(isStr)) bad('review.cuts must be an array of strings', 'review.cuts');
    if (rv.rtCheck !== null) {
      const c = rv.rtCheck;
      if (!isObj(c)) bad('review.rtCheck must be an object or null', 'review.rtCheck');
      else {
        checkKeys(c, ['checkedOn', 'url', 'rtSitePercent', 'rtSiteReviews', 'outcome'], 'review.rtCheck', out);
        if (!isStr(c.checkedOn) || !isStr(c.url) || !isStr(c.outcome)) bad('rtCheck needs string checkedOn, url, outcome', 'review.rtCheck');
        if (typeof c.rtSitePercent !== 'number' || typeof c.rtSiteReviews !== 'number') {
          bad('rtCheck.rtSitePercent and rtSiteReviews must be numbers', 'review.rtCheck');
        }
      }
    }
  }
  return out;
}

const inRange = (n: number, [lo, hi]: readonly [number, number]): boolean => n >= lo && n <= hi;

/** Validate one article file against spec 3.1. */
export function validateArticleSchema(raw: unknown, ctx: SchemaContext = {}): Issue[] {
  const shape = structure(raw);
  if (shape.length) return shape;
  const a = raw as Article;
  const out: Issue[] = [];
  const { film, stats } = ctx;

  const render = (text: string): string => {
    if (!film || !stats) return text;
    try {
      return renderTokens(text, { film, stats, sources: a.sources });
    } catch {
      return text; // reported by the token check
    }
  };
  const names = film ? filmNames(film.omdb.title, a.shortTitle) : [];
  const namesFilm = (rendered: string): boolean => namesFilmIn(rendered, names);

  // identity
  if (!SLUG_RE.test(a.slug)) out.push(issue('slug', `slug "${a.slug}" must match ${SLUG_RE}`, 'slug'));
  if (ctx.fileName !== undefined && ctx.fileName !== `${a.slug}.json`) {
    out.push(issue('slug', `slug "${a.slug}" does not match the file name ${ctx.fileName}`, 'slug'));
  }
  if (!film) out.push(issue('film-missing', `no film with slug "${a.slug}" in films.json`, 'slug'));
  else {
    if (film.slug !== a.slug) out.push(issue('slug', `slug "${a.slug}" differs from the film slug "${film.slug}"`, 'slug'));
    if (film.omdb.imdbId !== a.imdbId) {
      out.push(issue('imdb-id', `imdbId ${a.imdbId} does not match the film (${film.omdb.imdbId})`, 'imdbId'));
    }
  }

  // status, dates, review
  if (!STATUSES.includes(a.status)) out.push(issue('status', `status "${a.status}" must be one of ${STATUSES.join(', ')}`, 'status'));
  if (a.status === 'published') {
    if (a.published === null) out.push(issue('published', 'status "published" needs a published date', 'published'));
    else if (!isIsoDate(a.published)) out.push(issue('date', `published "${a.published}" is not a YYYY-MM-DD date`, 'published'));
  } else if (a.published !== null) {
    out.push(issue('published', 'published must be null unless status is "published"', 'published'));
  }
  if (!isIsoDate(a.contentUpdated)) out.push(issue('date', `contentUpdated "${a.contentUpdated}" is not a YYYY-MM-DD date`, 'contentUpdated'));
  if (!isIsoDate(a.review.writtenOn)) out.push(issue('date', 'review.writtenOn is not a YYYY-MM-DD date', 'review.writtenOn'));
  const verified = a.status === 'checked' || a.status === 'published';
  if (verified) {
    if (!a.review.factChecker) out.push(issue('review', `status "${a.status}" needs review.factChecker`, 'review.factChecker'));
    if (!a.review.factCheckedOn) out.push(issue('review', `status "${a.status}" needs review.factCheckedOn`, 'review.factCheckedOn'));
  }
  if (a.review.factCheckedOn && !isIsoDate(a.review.factCheckedOn)) {
    out.push(issue('date', 'review.factCheckedOn is not a YYYY-MM-DD date', 'review.factCheckedOn'));
  }
  if (!a.review.writer.trim()) out.push(issue('review', 'review.writer is empty', 'review.writer'));

  const check = a.review.rtCheck;
  if (check) {
    if (!isIsoDate(check.checkedOn)) out.push(issue('date', 'rtCheck.checkedOn is not a YYYY-MM-DD date', 'review.rtCheck'));
    if (!/^https:\/\/(www\.)?rottentomatoes\.com\//.test(check.url)) {
      out.push(issue('rt-check', 'rtCheck.url must be an https://www.rottentomatoes.com/ page', 'review.rtCheck.url'));
    }
    if (!['match', 'note', 'hold'].includes(check.outcome)) {
      out.push(issue('rt-check', `rtCheck.outcome "${check.outcome}" must be match, note or hold`, 'review.rtCheck.outcome'));
    } else if (film) {
      const want = expectedRtOutcome(check.rtSitePercent, film.omdb.rtPercent);
      if (check.outcome !== want) {
        out.push(
          issue(
            'rt-check',
            `RT site ${check.rtSitePercent}% vs OMDb ${film.omdb.rtPercent}% is a "${want}" (0-2 match, 3-9 note, 10+ hold), not "${check.outcome}"`,
            'review.rtCheck.outcome',
          ),
        );
      }
    }
    if (check.outcome === 'hold' && verified) {
      out.push(issue('rt-check', 'outcome "hold" means the article is not published; keep status at draft or review', 'review.rtCheck.outcome'));
    }
  } else if (verified && film && stats && r15Required(film, stats)) {
    out.push(issue('rt-check', 'R15: abs(gap) >= 30 or fewer than 25,000 votes require a Rotten Tomatoes hand check (review.rtCheck)', 'review.rtCheck'));
  }

  // shortTitle and generated title
  if (a.shortTitle !== undefined) {
    if (a.shortTitle.length > MAX_SHORT_TITLE_LENGTH || a.shortTitle.length === 0) {
      out.push(issue('short-title', `shortTitle must be 1 to ${MAX_SHORT_TITLE_LENGTH} characters (is ${a.shortTitle.length})`, 'shortTitle'));
    } else if (film && !isRecognisableShortTitle(a.shortTitle, film.omdb.title)) {
      out.push(issue('short-title', `shortTitle "${a.shortTitle}" is not a recognisable form of "${film.omdb.title}"`, 'shortTitle'));
    }
  }
  let title: string | null = null;
  if (film) {
    try {
      title = generatedTitle(film, a.shortTitle).title;
    } catch (err) {
      out.push(issue('short-title', (err as Error).message, 'shortTitle'));
    }
  }

  // h1
  const h1 = render(a.h1);
  if (!inRange(h1.length, FIELD_LIMITS.h1)) out.push(issue('h1', `h1 is ${h1.length} characters; allowed 30 to 90`, 'h1'));
  if (film && !namesFilm(h1)) out.push(issue('h1', 'h1 must contain the film title (or shortTitle)', 'h1'));
  if (title && h1.trim().toLowerCase() === title.toLowerCase()) out.push(issue('h1', 'h1 must differ from the generated page title', 'h1'));

  // description
  const description = render(a.description);
  if (!inRange(description.length, FIELD_LIMITS.description)) {
    out.push(issue('description', `description renders to ${description.length} characters; allowed 120 to 158`, 'description'));
  }
  if (film && !namesFilm(description)) out.push(issue('description', 'description must contain the film title', 'description'));
  if (!/rotten tomatoes/i.test(description)) out.push(issue('description', 'description must contain "Rotten Tomatoes"', 'description'));
  if (!/\{\{\s*(?:imdb|imdbX10|rt|metascore)\s*\}\}/.test(a.description)) {
    out.push(issue('description', 'description must contain a score token ({{imdb}}, {{imdbX10}}, {{rt}} or {{metascore}})', 'description'));
  }

  // summary
  const words = countWords(a.summary);
  if (!inRange(words, FIELD_LIMITS.summaryWords)) out.push(issue('summary', `summary is ${words} words; allowed 45 to 75`, 'summary'));
  // names are masked before splitting, so "Mr. Harrigan's Phone" or "K.O." does not end the sentence
  const first = maskedSentences(a.summary, names)[0] ?? a.summary;
  const namesInFirst = first.includes(TITLE_MASK) || (film ? namesFilm(first) : true);
  if (!namesInFirst) out.push(issue('summary', 'the first sentence of the summary must name the film', 'summary'));
  for (const t of ['imdb', 'rt']) {
    if (!new RegExp(`\\{\\{\\s*${t}\\s*\\}\\}`).test(first)) out.push(issue('summary', `the first sentence of the summary must contain {{${t}}}`, 'summary'));
  }
  if (!/\{\{\s*asOf\s*\}\}/.test(a.summary)) out.push(issue('summary', 'the summary must contain {{asOf}}', 'summary'));
  if (stats) {
    for (const problem of directionProblems(a.summary, { ...stats, names })) {
      out.push(issue('summary', `the summary ${problem} (archetype "${stats.archetype}")`, 'summary'));
    }
  }

  // sections
  const ids = a.sections.map((s) => s.id);
  for (const id of REQUIRED_SECTIONS) if (!ids.includes(id)) out.push(issue('section', `missing required section "${id}"`, 'sections'));
  if (check?.outcome === 'note' && !ids.includes('data-note')) {
    out.push(issue('section', 'rtCheck outcome "note" requires a "data-note" section', 'sections'));
  }
  const seen = new Set<string>();
  a.sections.forEach((s, i) => {
    const where = `sections[${i}:${s.id}]`;
    if (![...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS].includes(s.id as never)) {
      out.push(issue('section', `unknown section id "${s.id}"`, where));
    }
    if (seen.has(s.id)) out.push(issue('section', `duplicate section id "${s.id}"`, where));
    seen.add(s.id);
    if (s.paragraphs.length === 0 || s.paragraphs.some((p) => !p.trim())) out.push(issue('section', 'section needs at least one non-empty paragraph', where));
    const budget = SECTION_WORDS[s.id];
    if (budget) {
      const n = s.paragraphs.reduce((sum, p) => sum + countWords(p), 0);
      if (!inRange(n, budget)) out.push(issue('section-length', `"${s.id}" is ${n} words; allowed ${budget[0]} to ${budget[1]}`, where));
    }
    const heading = render(s.heading);
    if (!inRange(heading.length, FIELD_LIMITS.heading)) out.push(issue('heading', `heading is ${heading.length} characters; allowed 20 to 80`, where));
    if (!heading.trim().endsWith('?')) out.push(issue('heading', 'heading must be phrased as a question', where));
  });

  // faq
  if (!inRange(a.faq.length, FIELD_LIMITS.faqItems)) out.push(issue('faq', `faq has ${a.faq.length} items; allowed 2 or 3`, 'faq'));
  a.faq.forEach((f, i) => {
    const where = `faq[${i}]`;
    const q = render(f.q);
    if (!inRange(q.length, FIELD_LIMITS.faqQ)) out.push(issue('faq', `question is ${q.length} characters; allowed 25 to 100`, where));
    if (film && !namesFilm(q)) out.push(issue('faq', 'question must contain the film title', where));
    const n = countWords(f.a);
    if (!inRange(n, FIELD_LIMITS.faqAWords)) out.push(issue('faq', `answer is ${n} words; allowed 35 to 90`, where));
  });

  // sources
  if (a.sources.length > FIELD_LIMITS.sources) out.push(issue('source', `${a.sources.length} sources; allowed at most 6`, 'sources'));
  const sourceIds = new Set<string>();
  a.sources.forEach((s, i) => {
    const where = `sources[${i}]`;
    if (!SLUG_RE.test(s.id)) out.push(issue('source', `source id "${s.id}" must be lowercase letters, digits and hyphens`, where));
    if (sourceIds.has(s.id)) out.push(issue('source', `duplicate source id "${s.id}"`, where));
    sourceIds.add(s.id);
    let url: URL | null = null;
    try {
      url = new URL(s.url);
    } catch {
      /* reported below */
    }
    if (!url || url.protocol !== 'https:') out.push(issue('source', `source url "${s.url}" must be a valid https URL`, where));
    if (!s.title.trim() || !s.publisher.trim()) out.push(issue('source', 'source needs a title and a publisher', where));
    if (!isIsoDate(s.accessed)) out.push(issue('date', `source accessed "${s.accessed}" is not a YYYY-MM-DD date`, where));
    if (!s.supports.trim() || s.supports.length > FIELD_LIMITS.supports) {
      out.push(issue('source', `source.supports must be 1 to ${FIELD_LIMITS.supports} characters`, where));
    }
  });

  // related picks
  const rel = a.related ?? [];
  if (rel.length > FIELD_LIMITS.related) out.push(issue('related', `${rel.length} related picks; allowed at most 2`, 'related'));
  rel.forEach((r, i) => {
    if (!SLUG_RE.test(r.slug) || !r.reason.trim()) out.push(issue('related', 'related pick needs a valid slug and a non-empty reason', `related[${i}]`));
  });

  return out;
}
