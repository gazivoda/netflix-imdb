// Text of `npm run blog:brief {slug}` (spec 7.1): everything a writer needs for one
// film, with every number taken from films.json. Pure: returns a string.

import { displayTitle } from './format';
import { computeRelated } from './related';
import { FIELD_LIMITS, SECTION_WORDS, r15Required } from './schema';
import { LIMITS } from './similarity';
import { nearestByGap, type FilmStats, type StatsBySlug } from './stats';
import { generatedTitle, titlesNeedingShortTitle } from './title';
import { TOKEN_NAMES, tokenValues } from './tokens';
import { ALWAYS_FORBIDDEN, BANNED_PHRASES, DIRECTION_HELP, FORBIDDEN_CLAIMS, TIER_USE, tierNeverRules } from './wording';
import type { Article, Film } from './types';

export interface BriefInputs {
  film: Film;
  films: Film[];
  stats: StatsBySlug;
  /** The existing article file, when one is already on disk. */
  existing?: Article;
}

const list = (items: string[]): string => (items.length ? items.join(', ') : '(none)');
const h = (title: string): string => `\n== ${title} ==`;
const labels = (rules: { label: string }[]): string => [...new Set(rules.map((r) => r.label))].join('; ');

const SECTION_ORDER: Record<FilmStats['archetype'], string> = {
  'critics-higher': 'why-split, the-film, who-it-suits (opens with why-split)',
  'audience-higher': 'why-split, the-film, who-it-suits (opens with why-split)',
  'agreed-high': 'who-it-suits, why-split, the-film (opens with who-it-suits)',
  'agreed-low': 'who-it-suits, why-split, the-film (opens with who-it-suits)',
  'agreed-mixed': 'who-it-suits, why-split, the-film (opens with who-it-suits)',
};

export function buildBrief({ film, films, stats, existing }: BriefInputs): string {
  const s = stats[film.slug];
  const o = film.omdb;
  const n = film.netflix;
  const name = displayTitle(o.title);
  const lines: string[] = [`WRITER BRIEF: ${name} (${o.year})`, `slug: ${film.slug}    file: data/blog/articles/${film.slug}.json`];
  if (existing) lines.push(`existing article: status ${existing.status}, contentUpdated ${existing.contentUpdated}`);

  lines.push(h('FILM RECORD (films.json; numbers only via tokens)'));
  lines.push(
    `imdbId ${o.imdbId}    rated ${o.rated ?? 'N/A'}    released ${o.released ?? 'N/A'}    runtime ${o.runtimeMin} min`,
    `genres: ${list(o.genres)}`,
    `directors: ${list(o.directors)}`,
    `writers: ${list(o.writers)}`,
    `actors (billing order): ${list(o.actors)}`,
    `languages: ${list(o.languages)}    countries: ${list(o.countries)}`,
    `awards (OMDb string, quote exactly): ${o.awards ?? '(none)'}`,
    `plot (OMDb; at most one own-words sentence of 30 words, no 6-word run copied): ${o.plot ?? '(none)'}`,
    `IMDb ${o.imdbRating} (${o.imdbVotes} votes)    RT ${o.rtPercent}%    Metascore ${o.metascore ?? 'N/A'}`,
    `scores fetched: ${film.fetchedAt}    data changed: ${film.dataChangedAt}`,
  );

  lines.push(h('NETFLIX TOP 10 DATA'));
  lines.push(
    `category ${n.category}    popularity rank ${film.popularityRank} of ${s.setSize}    hours ${n.popularityHours} (${n.hoursSource})`,
    `weeks in Top 10 ${n.weeksInTop10}    peak rank ${n.peakRank ?? 'N/A'}    first week ${n.firstWeek ?? 'N/A'}    last week ${n.lastWeek ?? 'N/A'}`,
    `Most Popular list rank: ${n.mostPopularRank ?? 'not on the list'}    runtime per Netflix: ${n.runtimeMin ?? 'not published'}`,
  );

  lines.push(h('DERIVED (computed at build, never stored)'));
  lines.push(
    `gap ${s.gap > 0 ? '+' : ''}${s.gap} (RT ${o.rtPercent} minus IMDb ${s.imdbScaled} on the 100 scale; positive = critics higher)`,
    `abs gap ${s.absGap}    tier: ${s.tier}    archetype: ${s.archetype}`,
    `gap rank ${s.gapRank} of ${s.setSize} (1 = widest)    gap percentile ${s.gapPercentile}`,
    `primary genre ${s.genre}: ${s.genreCount} films, median gap ${s.genreMedianGap ?? 'N/A'}, this film is #${s.genrePosition} by abs gap in the genre`,
    `template section order: ${SECTION_ORDER[s.archetype]}`,
  );

  lines.push(h('TOKENS (write these, never the digits; a "NULL" token is a build error)'));
  const values = tokenValues({ film, stats: s });
  for (const t of TOKEN_NAMES) lines.push(`{{${t}}}`.padEnd(22) + (values[t] === null ? 'NULL (do not use)' : values[t]));
  lines.push('{{cite:id}}'.padEnd(22) + 'source number; id must exist in `sources`, and every source must be cited');

  lines.push(h('WORDING FOR THIS GAP'));
  lines.push(
    `use: ${TIER_USE[s.tier].join(' | ')}`,
    `never: ${labels(tierNeverRules(s.tier, s.gapRank)) || '(no tier-specific bans)'}`,
    `direction required in summary and why-split: ${DIRECTION_HELP[s.archetype]}`,
    `always forbidden: ${labels(ALWAYS_FORBIDDEN)}`,
    `forbidden claims: ${labels(FORBIDDEN_CLAIMS)}`,
  );

  lines.push(h('TITLE AND HEADINGS'));
  try {
    const g = generatedTitle(film, existing?.shortTitle);
    lines.push(`generated <title> (${g.variant}): ${g.title} (${g.title.length} chars)`);
  } catch {
    lines.push(`generated <title>: NO FORM FITS IN 50 CHARS. Set "shortTitle" (<= 29 chars, a recognisable form of "${name}").`);
  }
  lines.push(
    `h1: ${FIELD_LIMITS.h1[0]}-${FIELD_LIMITS.h1[1]} chars, contains the film name, differs from the title above`,
    `description: rendered ${FIELD_LIMITS.description[0]}-${FIELD_LIMITS.description[1]} chars; film name, "Rotten Tomatoes" and a score token`,
    'section headings: 20-80 chars, phrased as questions about this film (your own, not reused)',
  );

  lines.push(h('R15 RT HAND CHECK'));
  lines.push(
    r15Required(film, s)
      ? `REQUIRED: abs gap ${s.absGap} or ${o.imdbVotes} votes triggers the check (the fact-checker records review.rtCheck).`
      : 'not required (abs gap under 30 and 25,000+ votes), unless this film is a pilot film.',
  );

  lines.push(h('WORD BUDGETS'));
  lines.push(
    `prose (summary + paragraphs + FAQ answers): ${LIMITS.minProseWords}-${LIMITS.maxProseWords} words, at least ${LIMITS.minUniqueWords} unique`,
    `summary 45-75 words; faq 2-3 items (q 25-100 chars with the film name, a 35-90 words)`,
    ...Object.entries(SECTION_WORDS).map(([id, [lo, hi]]) => `section ${id}: ${lo}-${hi} words`),
  );

  lines.push(h(`GENRE PEERS (${s.genre})`));
  const peers = films.filter((f) => f.slug !== film.slug && (f.omdb.genres[0] ?? 'Other') === s.genre);
  for (const p of peers.slice(0, 12)) lines.push(`${p.slug}    gap ${stats[p.slug].gap > 0 ? '+' : ''}${stats[p.slug].gap}    rank ${p.popularityRank}`);
  if (peers.length === 0) lines.push('(no other film with this primary genre)');

  lines.push(h('RELATED LINKS (preview over all films; the build uses published articles only)'));
  const rel = computeRelated(film, { films, stats, published: films.map((f) => f.slug), picks: existing?.related });
  for (const r of rel) lines.push(`${r.kind.padEnd(14)} ${r.slug}${r.reason ? `  (${r.reason})` : ''}`);
  lines.push(`nearest by gap: ${nearestByGap(film, films, stats, 3).map((f) => f.slug).join(', ')}`);
  lines.push('your own picks go in `related` (max 2, shared director or actor, or a cited link)');

  lines.push(h('BANNED PHRASES'));
  lines.push(labels(BANNED_PHRASES));

  const need = titlesNeedingShortTitle(films);
  lines.push(h('NOTES'));
  lines.push(
    `films in this set that need a shortTitle: ${need.length}${need.includes(film.slug) ? ' (including this one)' : ''}`,
    'finish with: npm run blog:check -- ' + film.slug,
  );
  return lines.join('\n') + '\n';
}
