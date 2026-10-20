// Pure view-model builders for one article page: the generated score table, the
// "where it sits" facts, the section order, the sources list and the related links.
// No React, no I/O: unit-tested in tests/blog/pages-article.test.ts.

import { formatAsOf, formatHours, formatImdb, formatSigned, formatVotes } from '../../../lib/blog/format';
import { computeRelated, type RelatedKind } from '../../../lib/blog/related';
import { nearestByGap, ordinal, type Archetype, type FilmStats, type StatsBySlug, type Tier } from '../../../lib/blog/stats';
import { renderTokens } from '../../../lib/blog/tokens';
import { articleLabel, displayTitle } from '../../../lib/blog/title';
import type { Article, ArticleSection, Film, FilmsFile } from '../../../lib/blog/types';

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  'critics-higher': 'Critics scored higher',
  'audience-higher': 'Audiences scored higher',
  'agreed-high': 'Critics and audiences agree, both high',
  'agreed-low': 'Critics and audiences agree, both low',
  'agreed-mixed': 'Critics and audiences roughly agree, mid-range',
};

export const TIER_LABEL: Record<Tier, string> = {
  agree: 'within a few points',
  slight: 'a small gap',
  clear: 'a clear gap',
  wide: 'a wide gap',
  'very-wide': 'a very wide gap',
};

export interface ScoreRow {
  label: string;
  value: string;
  note: string;
  /** Which column-head tag colours the row label. */
  kind?: 'imdb' | 'rt';
}

/** The generated score table (spec 3.2). Values are the films.json values, nothing else. */
export function scoreRows(film: Film, stats: FilmStats): ScoreRow[] {
  const o = film.omdb;
  const rows: ScoreRow[] = [
    { label: 'IMDb rating', value: formatImdb(o.imdbRating), note: 'Average user rating out of 10', kind: 'imdb' },
    { label: 'IMDb votes', value: formatVotes(o.imdbVotes), note: 'Number of ratings behind the IMDb score' },
    { label: 'Rotten Tomatoes', value: `${o.rtPercent}%`, note: 'Tomatometer: share of critic reviews that are positive', kind: 'rt' },
  ];
  if (o.metascore !== null) rows.push({ label: 'Metascore', value: String(o.metascore), note: 'Metacritic weighted critic average out of 100' });
  rows.push(
    { label: 'IMDb x 10', value: String(stats.imdbScaled), note: 'IMDb rating on the 0 to 100 scale used for the gap' },
    {
      label: 'Gap',
      value: formatSigned(stats.gap),
      note: 'Rotten Tomatoes minus IMDb x 10, in points. Positive means critics scored higher',
    },
    { label: 'Gap rank', value: `${ordinal(stats.gapRank)} of ${stats.setSize}`, note: 'By size of the gap, 1st is the widest' },
    { label: 'Reading', value: ARCHETYPE_LABEL[stats.archetype], note: `The scores differ by ${TIER_LABEL[stats.tier]}` },
  );
  return rows;
}

export interface FactPart {
  text: string;
  /** Present only for published articles. */
  href?: string;
}

export interface FactRow {
  term: string;
  parts: FactPart[];
}

const filmPart = (f: Film, published: ReadonlySet<string>, suffix = ''): FactPart => ({
  text: `${articleLabel(f)}${suffix}`,
  ...(published.has(f.slug) ? { href: `/blog/${f.slug}` } : {}),
});

export interface FactContext {
  films: Film[];
  stats: StatsBySlug;
  published: ReadonlySet<string>;
}

/** The "where it sits" facts (spec 3.2): a definition list, never sentences. */
export function factRows(film: Film, stats: FilmStats, ctx: FactContext): FactRow[] {
  const n = film.netflix;
  const rows: FactRow[] = [
    { term: 'Gap compared with the set', parts: [{ text: `Wider than ${stats.gapPercentile}% of the other ${stats.setSize - 1} films` }] },
    {
      term: `Primary genre: ${stats.genre}`,
      parts: [
        {
          text:
            `${stats.genreCount} ${stats.genreCount === 1 ? 'film' : 'films'} in this set` +
            (stats.genreMedianGap === null ? '' : `, median gap ${formatSigned(stats.genreMedianGap)}`) +
            `, this film is ${ordinal(stats.genrePosition)} by size of gap`,
        },
      ],
    },
  ];
  const near = nearestByGap(film, ctx.films, ctx.stats, 2);
  if (near.length) {
    const parts: FactPart[] = [];
    near.forEach((f, i) => {
      if (i > 0) parts.push({ text: '; ' });
      parts.push(filmPart(f, ctx.published, `, gap ${formatSigned(ctx.stats[f.slug].gap)}`));
    });
    rows.push({ term: 'Closest gaps in the set', parts });
  }
  rows.push({ term: 'Netflix popularity rank', parts: [{ text: `${ordinal(film.popularityRank)} of ${stats.setSize} by hours viewed` }] });
  rows.push({ term: 'Weeks in the Netflix Top 10', parts: [{ text: String(n.weeksInTop10) }] });
  if (n.peakRank !== null) rows.push({ term: 'Peak Netflix Top 10 rank', parts: [{ text: String(n.peakRank) }] });
  if (n.popularityHours > 0) {
    const basis = n.hoursSource === 'first-91-days' ? 'first 91 days on Netflix' : 'summed over its weeks in the global Top 10';
    rows.push({ term: 'Hours viewed', parts: [{ text: `${formatHours(n.popularityHours)} hours, ${basis}` }] });
  }
  return rows;
}

/** Spec 3.3.4: split archetypes open with why-split, agreed ones with who-it-suits. */
export function sectionOrder(archetype: Archetype): string[] {
  return archetype.startsWith('agreed')
    ? ['who-it-suits', 'why-split', 'the-film', 'more']
    : ['why-split', 'the-film', 'who-it-suits', 'more'];
}

export interface RenderedSection {
  id: string;
  heading: string;
  paragraphs: string[];
}

export interface RenderedArticle {
  h1: string;
  summary: string;
  sections: RenderedSection[];
  /** The R15 data note, shown next to the numbers instead of in the section flow. */
  dataNote: RenderedSection | null;
  faq: { q: string; a: string }[];
}

/** Render every token of the article's prose. Throws TokenError on a bad token (build error). */
export function renderArticle(article: Article, film: Film, stats: FilmStats): RenderedArticle {
  const ctx = { film, stats, sources: article.sources };
  const r = (t: string): string => renderTokens(t, ctx);
  const section = (s: ArticleSection): RenderedSection => ({ id: s.id, heading: r(s.heading), paragraphs: s.paragraphs.map(r) });
  const order = sectionOrder(stats.archetype);
  const flow = article.sections.filter((s) => s.id !== 'data-note');
  const rank = (id: string): number => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  const note = article.sections.find((s) => s.id === 'data-note');
  return {
    h1: r(article.h1),
    summary: r(article.summary),
    sections: [...flow].sort((a, b) => rank(a.id) - rank(b.id)).map(section),
    dataNote: note ? section(note) : null,
    faq: article.faq.map((f) => ({ q: r(f.q), a: r(f.a) })),
  };
}

export interface SourceLink {
  title: string;
  publisher: string;
  url: string;
  /** Present for the generated data sources. */
  detail?: string;
}

/** Writer sources, in order: citation `[n]` is the n-th entry. */
export const citedSources = (article: Article): (SourceLink & { id: string; supports: string; accessed: string })[] =>
  article.sources.map((s) => ({ id: s.id, title: s.title, publisher: s.publisher, url: s.url, supports: s.supports, accessed: s.accessed }));

export const NETFLIX_TOP10_URL = 'https://www.netflix.com/tudum/top10';
export const OMDB_URL = 'https://www.omdbapi.com/';

/** The generated data sources (spec 3.2). The Rotten Tomatoes page is listed only when it was checked by hand. */
export function dataSources(film: Film, article: Article, file: FilmsFile): SourceLink[] {
  const links: SourceLink[] = [
    { title: 'OMDb API record', publisher: 'OMDb', url: OMDB_URL, detail: `film facts and the IMDb and Rotten Tomatoes scores, fetched ${formatAsOf(film.fetchedAt)}` },
    { title: `${displayTitle(film.omdb.title)} on IMDb`, publisher: 'IMDb', url: `https://www.imdb.com/title/${film.omdb.imdbId}/`, detail: 'the title page the IMDb rating belongs to' },
    {
      title: 'Netflix Top 10 data',
      publisher: 'Netflix',
      url: NETFLIX_TOP10_URL,
      detail: `weekly global Top 10, ${formatAsOf(file.netflix.firstWeek)} to ${formatAsOf(file.netflix.lastWeek)}`,
    },
  ];
  const rt = article.review.rtCheck;
  if (rt && rt.outcome !== 'hold' && rt.url.startsWith('https://')) {
    links.push({ title: `${displayTitle(film.omdb.title)} on Rotten Tomatoes`, publisher: 'Rotten Tomatoes', url: rt.url, detail: `checked by hand on ${formatAsOf(rt.checkedOn)}` });
  }
  return links;
}

/** "Scores as of ..." line (spec 4.6). */
export const scoresAsOfLine = (film: Film, file: FilmsFile): string =>
  `Scores as of ${formatAsOf(film.fetchedAt)}, via OMDb. Popularity from Netflix's Top 10 data (${formatAsOf(file.netflix.firstWeek)} to ${formatAsOf(file.netflix.lastWeek)}).`;

export const RELATED_HINT: Record<RelatedKind, string> = {
  pick: '',
  'nearest-gap': 'Similar gap in the same genre',
  opposite: 'Split in the other direction',
  'shared-people': 'Shares a director or cast member',
  'next-nearest': 'Close gap elsewhere in the set',
  previous: 'Previous in popularity order',
  next: 'Next in popularity order',
};

export interface RelatedItem {
  slug: string;
  label: string;
  hint: string;
  kind: RelatedKind;
}

/** Computed related links over published films only (spec 4.4). */
export function relatedItems(article: Article, film: Film, ctx: { films: Film[]; stats: StatsBySlug; published: Iterable<string> }): RelatedItem[] {
  const bySlug = new Map(ctx.films.map((f) => [f.slug, f]));
  return computeRelated(film, { ...ctx, picks: article.related }).flatMap((l) => {
    const f = bySlug.get(l.slug);
    return f ? [{ slug: l.slug, label: articleLabel(f), hint: l.reason || RELATED_HINT[l.kind], kind: l.kind }] : [];
  });
}
