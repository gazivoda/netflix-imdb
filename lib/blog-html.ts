// Pure checks for the PRERENDERED blog pages (spec 6.1, last row). Takes HTML plus the
// film and article data and returns findings shaped like lib/html-seo.ts's checkPage;
// no filesystem or network, so it is unit-testable with small synthetic HTML
// (tests/lib/blog-html.test.ts) and used by scripts/validate-seo.mjs on the real
// `next build` output.
//
// The jest tests (tests/blog/*) check the data and the builders; this file checks what
// actually shipped: that tokens were rendered, that the visible numbers equal films.json,
// that the JSON-LD on the rendered page is clean, and that the articles do not read alike.

import { formatAsOf, formatImdb } from './blog/format';
import { jaccard, ngramSet, tokenizeWords } from './blog/similarity';
import type { Article, Film } from './blog/types';
import { htmlFileForPath, type SeoFinding } from './html-seo';

export type { SeoFinding };

/** Max 5-gram Jaccard between the rendered body text of any two articles (spec 6.1). */
export const RENDERED_JACCARD_MAX = 0.35;
/** Hub HTML budget. RULING B8: the spec's 120 KB (4.3) is relaxed to 160 KB because the 100-row table is the core content. */
export const HUB_MAX_BYTES = 160 * 1024;

// ------------------------------------------------------------------ small HTML helpers
// html-seo.ts keeps its helpers private; these are the few this file needs.

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·' };

const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

type Attrs = Record<string, string>;

function parseAttrs(tag: string): Attrs {
  const attrs: Attrs = {};
  const re = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

const stripNonContent = (html: string): string =>
  html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');

const BLOCK_TAG = /<\/?(?:p|div|h[1-6]|li|ul|ol|section|summary|details|br|tr|td|th|dt|dd|header|footer|nav|main|article)\b[^>]*>/gi;

/** Visible text: scripts, styles and comments gone, block tags become spaces, entities decoded, whitespace collapsed. */
const plainText = (html: string): string =>
  decode(stripNonContent(html).replace(BLOCK_TAG, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

/** True when one of the CSS-module class names (`site-chrome_lede__XQQ1d`) contains `token` as a word. */
const hasClassWord = (attrs: Attrs, token: string): boolean =>
  (attrs.class ?? '')
    .split(/\s+/)
    .some((c) => c.split(/[_-]+/).includes(token));

/** Inner HTML of every top-level `<tag ...>...</tag>` whose open tag passes `keep`; nesting-aware. */
function elements(html: string, tag: string, keep: (a: Attrs) => boolean = () => true): string[] {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!m[1]) {
      if (depth > 0) depth++;
      else if (keep(parseAttrs(m[0]))) {
        depth = 1;
        start = re.lastIndex;
      }
    } else if (depth > 0 && --depth === 0) {
      out.push(html.slice(start, m.index));
    }
  }
  return out;
}

// ------------------------------------------------------------------ article body

/**
 * The written article text, as chunks (a 5-gram never spans two chunks).
 *
 * Markers, determined from the real build output (Next 14, CSS modules):
 *  - everything is taken from inside the single `<article>` element, so the site nav,
 *    header and footer are never read;
 *  - the lede paragraph (`<p class="..._lede__...">`, the article summary);
 *  - every `<section>` (the written sections; GuideLayout and the page use `<section>`
 *    only for them);
 *  - every `<details>` (FAQ questions and answers);
 *  - the R15 data-note callout (`<div class="blog_dataNote__...">`).
 * Everything else inside `<article>` is chrome or generated and left out: breadcrumb
 * `<nav>`, byline, the score `<table>`, the CTA, the "Where it sits" `<dl>`, the sources
 * and related lists, the method line, and the generated headings between sections.
 */
export function articleBodyChunks(html: string): string[] {
  const article = elements(stripNonContent(html), 'article')[0];
  if (article === undefined) return [];
  return [
    ...elements(article, 'p', (a) => hasClassWord(a, 'lede')),
    ...elements(article, 'section'),
    ...elements(article, 'details'),
    ...elements(article, 'div', (a) => hasClassWord(a, 'dataNote')),
  ]
    .map(plainText)
    .filter(Boolean);
}

export const articleBodyText = (html: string): string => articleBodyChunks(html).join('\n');

// ------------------------------------------------------------------ JSON-LD

type Json = unknown;
type JsonObject = Record<string, Json>;
const isObject = (v: Json): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

function walk(value: Json, visit: (o: JsonObject) => void): void {
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit));
  else if (isObject(value)) {
    visit(value);
    Object.values(value).forEach((v) => walk(v, visit));
  }
}

const typesOf = (o: JsonObject): string[] => {
  const t = o['@type'];
  return Array.isArray(t) ? t.map(String) : t ? [String(t)] : [];
};

const FORBIDDEN_KEYS = new Set(['aggregateRating', 'review', 'additionalProperty']);
const FORBIDDEN_TYPES = new Set(['AggregateRating', 'Review', 'FAQPage', 'HowTo']);
const URL_KEYS = new Set(['url', 'sameAs', 'item', 'image', 'logo', 'contentUrl', 'embedUrl', 'thumbnailUrl', 'license', 'mainEntityOfPage', '@id']);
const DATE_KEYS = ['datePublished', 'dateModified', 'dateCreated'];
// A time zone is required: bare dates are rejected (same rule as html-seo's jsonld-date).
const ISO = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

function isIso(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const day = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === `${m[1]}-${m[2]}-${m[3]}` && !Number.isNaN(Date.parse(s));
}

const isAbsoluteHttps = (u: string): boolean => {
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

const strings = (v: Json): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : []);

function jsonLdFindings(html: string, fail: (rule: string, message: string) => void): void {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const parsed: Json[] = [];
  for (const raw of blocks) {
    try {
      parsed.push(JSON.parse(raw));
    } catch {
      /* checkPage reports invalid JSON */
    }
  }
  if (!parsed.length) return fail('blog-jsonld', 'no parseable JSON-LD on the page');

  const count: Record<string, number> = { Movie: 0, BlogPosting: 0 };
  walk(parsed, (o) => {
    for (const t of typesOf(o)) {
      if (t in count) count[t]++;
      if (FORBIDDEN_TYPES.has(t)) fail('blog-jsonld', `forbidden @type "${t}" in JSON-LD`);
    }
    for (const [key, value] of Object.entries(o)) {
      if (FORBIDDEN_KEYS.has(key)) fail('blog-jsonld', `forbidden key "${key}" in JSON-LD`);
      for (const s of strings(value)) {
        if (/\bN\/A\b/.test(s)) fail('blog-jsonld', `"N/A" value under "${key}" in JSON-LD`);
        if (/^http:\/\//i.test(s)) fail('blog-jsonld', `non-https URL under "${key}": ${s}`);
      }
      if (URL_KEYS.has(key)) {
        for (const s of strings(value)) {
          if (!isAbsoluteHttps(s)) fail('blog-jsonld', `"${key}" is not an absolute https URL: ${s}`);
        }
      }
    }
    for (const key of DATE_KEYS) {
      const v = o[key];
      if (typeof v === 'string' && !isIso(v)) fail('blog-jsonld', `"${key}" is not a full ISO 8601 date-time with a time zone: ${v}`);
    }
    const { datePublished: pub, dateModified: mod } = o;
    if (typeof pub === 'string' && typeof mod === 'string' && isIso(pub) && isIso(mod) && Date.parse(mod) < Date.parse(pub)) {
      fail('blog-jsonld', `dateModified ${mod} is before datePublished ${pub}`);
    }
  });
  for (const type of Object.keys(count)) {
    if (count[type] !== 1) fail('blog-jsonld', `expected exactly one ${type} in JSON-LD, found ${count[type]}`);
  }
}

// ------------------------------------------------------------------ one article page

export interface BlogPageInput {
  path: string;
  html: string;
  film: Film;
  article: Article;
}

/** Cells of every table row as plain text: label (first cell) to value (second cell). */
function scoreTable(html: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const tr of elements(stripNonContent(html), 'tr')) {
    const cells = [...tr.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((c) => plainText(c[1]));
    if (cells.length >= 2 && !rows.has(cells[0].toLowerCase())) rows.set(cells[0].toLowerCase(), cells[1]);
  }
  return rows;
}

export function checkBlogPage({ path, html, film, article }: BlogPageInput): SeoFinding[] {
  const findings: SeoFinding[] = [];
  const fail = (rule: string, message: string) => findings.push({ path, rule, message });

  // The page must belong to a published article of this film.
  if (path !== `/blog/${film.slug}` || article.slug !== film.slug) {
    fail('blog-data', `page ${path} is checked against film "${film.slug}" and article "${article.slug}"`);
  }
  if (article.status !== 'published') {
    fail('blog-status', `article "${article.slug}" has status "${article.status}" but a page was prerendered for it`);
  }

  // Unrendered tokens, anywhere (visible text, attributes, scripts, flight payload).
  const at = html.indexOf('{{');
  if (at >= 0) {
    fail('blog-placeholder', `"{{" in the HTML: ...${html.slice(Math.max(0, at - 30), at + 40).replace(/\s+/g, ' ')}...`);
  }

  // Exactly one h1 (same wording as checkPage so the validator can de-duplicate).
  const h1s = (stripNonContent(html).match(/<h1[\s>]/gi) ?? []).length;
  if (h1s !== 1) fail('h1', `expected exactly one <h1>, found ${h1s}`);

  // "Scores as of" date equals the film's fetchedAt.
  const text = plainText(html);
  const expectedAsOf = formatAsOf(film.fetchedAt);
  const asOfs = [...text.matchAll(/Scores as of ([A-Z][a-z]+ \d{1,2}, \d{4})/g)].map((m) => m[1]);
  if (!asOfs.length) fail('blog-asof', `no visible "Scores as of" date (expected ${expectedAsOf})`);
  for (const d of new Set(asOfs)) {
    if (d !== expectedAsOf) fail('blog-asof', `visible "Scores as of ${d}" but the film was fetched ${expectedAsOf}`);
  }

  // Visible IMDb and Rotten Tomatoes values equal the films data.
  const table = scoreTable(html);
  const expected: [string, string][] = [
    ['IMDb rating', formatImdb(film.omdb.imdbRating)],
    ['Rotten Tomatoes', `${film.omdb.rtPercent}%`],
  ];
  for (const [label, want] of expected) {
    const got = table.get(label.toLowerCase());
    if (got === undefined) fail('blog-score', `no "${label}" row in the score table`);
    else if (got !== want) fail('blog-score', `"${label}" shows "${got}" but the films data says "${want}"`);
  }

  jsonLdFindings(html, fail);

  if (!articleBodyChunks(html).length) {
    fail('blog-body', 'no article body found (no lede, <section>, <details> or data note inside <article>)');
  }
  return findings;
}

// ------------------------------------------------------------------ across pages

export interface RenderedPage {
  path: string;
  html: string;
}

const pct3 = (x: number): string => x.toFixed(3);

/** Pairwise word-5-gram Jaccard over the rendered article bodies (see articleBodyChunks); one finding per offending pair. */
export function checkRenderedSimilarity(pages: RenderedPage[], max: number = RENDERED_JACCARD_MAX): SeoFinding[] {
  const grams = pages.map((p) => ngramSet(articleBodyChunks(p.html).map(tokenizeWords)));
  const findings: SeoFinding[] = [];
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const score = jaccard(grams[i], grams[j]);
      if (score > max) {
        findings.push({
          path: pages[j].path,
          rule: 'blog-similarity',
          message: `${pages[i].path} vs ${pages[j].path}: rendered article body 5-gram Jaccard ${pct3(score)} (max ${max})`,
        });
      }
    }
  }
  return findings;
}

/** Hub (`/blog`) HTML size, in bytes of UTF-8. */
export function checkHubSize({ path, html }: { path: string; html: string }): SeoFinding[] {
  const bytes = Buffer.byteLength(html, 'utf8');
  return bytes > HUB_MAX_BYTES
    ? [
        {
          path,
          rule: 'blog-hub-size',
          message: `hub HTML is ${(bytes / 1024).toFixed(1)} KB (budget ${HUB_MAX_BYTES / 1024} KB, RULING B8)`,
        },
      ]
    : [];
}

/**
 * Prerendered files (paths relative to .next/server/app) whose route is not in the registry.
 * An unpublished article is not in the registry, so a page prerendered for it lands here.
 */
export function unregisteredPages(
  prerendered: string[],
  registryPaths: string[],
  ignore: string[] = ['_not-found.html'],
): SeoFinding[] {
  const known = new Set([...registryPaths.map(htmlFileForPath), ...ignore]);
  return prerendered
    .filter((rel) => !known.has(rel))
    .map((rel) => ({ path: `/${rel}`, rule: 'registry', message: 'prerendered page is not in lib/pages.ts' }));
}
