// Links, citations, source URLs and related picks (spec 3.1, 6.1 links.test, 7.4).
// Pure functions, no I/O: the caller supplies the registered paths and film slugs.

import { issue, type Issue } from './issue';
import { allStrings, isProsePath } from './lint';
import { citedIds } from './tokens';
import type { Article } from './types';

export const MAX_INTERNAL_LINKS = 3;

/** Hosts a writer may not cite (7.4): forums, fan wikis, user-content and listicle sites. */
export const BANNED_SOURCE_HOSTS = [
  'reddit.com',
  'redd.it',
  'fandom.com',
  'wikia.com',
  'wikia.org',
  'quora.com',
  'medium.com',
  'buzzfeed.com',
  'ranker.com',
  'screenrant.com',
  'cbr.com',
  'looper.com',
  'listverse.com',
  'thetoptens.com',
  'pinterest.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
];

/** IMDb is fine as a title page, never for trivia, user reviews, quotes or boards. */
const IMDB_BANNED_PATH = /\/(?:trivia|reviews?|userreviews|quotes|goofs|board|news|faq|parentalguide)\b/i;
/** Rotten Tomatoes and Metacritic review pages carry excerpts; the film page itself is not a writer source. */
const REVIEW_PAGE = /(?:rottentomatoes|metacritic)\.com\/.*\/(?:reviews?|critic-reviews|user-reviews)\b/i;

/** A reason the URL may not be cited, or null when it is acceptable. */
export function bannedSourceReason(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'not a valid URL';
  }
  if (url.protocol !== 'https:') return 'must be https';
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  for (const banned of BANNED_SOURCE_HOSTS) {
    if (host === banned || host.endsWith(`.${banned}`)) return `${banned} is on the banned source list`;
  }
  if (host.endsWith('imdb.com') && IMDB_BANNED_PATH.test(url.pathname)) return 'IMDb trivia, reviews and quotes are not allowed sources';
  if (REVIEW_PAGE.test(`${host}${url.pathname}`)) return 'review pages (excerpts) are not allowed sources';
  return null;
}

export interface LinkContext {
  /** Registered page paths (lib/pages.ts). */
  registeredPaths: Iterable<string>;
  /** Slugs of every film in films.json. */
  filmSlugs: string[];
}

export interface MarkdownLink {
  anchor: string;
  target: string;
}

/** Markdown links `[anchor](target)` in a text. */
export function extractLinks(text: string): MarkdownLink[] {
  return [...text.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)].map((m) => ({ anchor: m[1], target: m[2] }));
}

/** Link, citation, source and related-pick findings for one article. */
export function checkLinks(article: Article, ctx: LinkContext): Issue[] {
  const out: Issue[] = [];
  const registered = new Set(ctx.registeredPaths);
  const prose = allStrings(article).filter((s) => isProsePath(s.where));

  let internal = 0;
  for (const s of prose) {
    for (const link of extractLinks(s.text)) {
      if (!link.anchor.trim()) out.push(issue('link-anchor', `link to ${link.target} has no anchor text`, s.where));
      if (!link.target.startsWith('/') || link.target.startsWith('//')) {
        out.push(issue('link-external', `"${link.target}" is not an internal path; only [anchor](/path) links are allowed`, s.where));
        continue;
      }
      internal++;
      const path = link.target.split(/[?#]/)[0];
      if (!registered.has(path)) out.push(issue('link-target', `"${path}" is not a registered page in lib/pages.ts`, s.where));
    }
  }
  if (internal > MAX_INTERNAL_LINKS) out.push(issue('link-count', `${internal} internal links; allowed at most ${MAX_INTERNAL_LINKS}`));

  const sourceIds = new Set(article.sources.map((s) => s.id));
  const cited = new Set<string>();
  for (const s of prose) {
    for (const id of citedIds(s.text)) {
      cited.add(id);
      if (!sourceIds.has(id)) out.push(issue('cite', `{{cite:${id}}} does not resolve to a source id`, s.where));
    }
  }
  article.sources.forEach((s, i) => {
    if (!cited.has(s.id)) out.push(issue('source-unused', `source "${s.id}" is never cited with {{cite:${s.id}}}`, `sources[${i}]`));
    const reason = bannedSourceReason(s.url);
    if (reason) out.push(issue('source-banned', `${s.url}: ${reason}`, `sources[${i}].url`));
  });

  const slugs = new Set(ctx.filmSlugs);
  (article.related ?? []).forEach((r, i) => {
    if (r.slug === article.slug) out.push(issue('related', 'an article cannot list itself as related', `related[${i}]`));
    else if (!slugs.has(r.slug)) out.push(issue('related', `related slug "${r.slug}" is not a film in films.json`, `related[${i}]`));
  });
  return out;
}
