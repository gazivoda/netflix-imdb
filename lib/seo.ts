// Pure SEO/GEO helpers: metadata + JSON-LD builders. No JSX, so they are unit
// testable in a node environment (see tests/lib/seo.test.ts).

import type { Metadata } from 'next';
import { SITE_URL, AUTHOR_NAME, PUBLISHED_DATE, LAST_UPDATED, EXTENSION_ZIP_PATH } from './content';
import { BLOG_HUB_PAGE, getPage, HOME_DESCRIPTION, type SitePage } from './pages';
import manifest from '../extension/manifest.json';
import { OG_SIZE, OG_ALT, OG_VERSION } from './og';
import { displayTitle } from './blog/format';
import type { Film } from './blog/types';
import { PROMO_VIDEO } from './promo-video';

export const SITE_NAME = 'Rating Watch';
export const TITLE_SUFFIX = ' · Rating Watch';

// Root has no trailing slash so sitemap, canonical and JSON-LD agree with what Next emits.
export const absoluteUrl = (path: string): string => (path === '/' ? SITE_URL : `${SITE_URL}${path}`);

/** Title as it will actually render in the SERP, suffix included. */
export const renderedTitle = (page: SitePage): string =>
  page.path === '/' ? page.title : `${page.title}${TITLE_SUFFIX}`;

/**
 * Per-page metadata from the registry. Every page gets its own canonical —
 * without one, Next inherits the root layout's canonical ('/') and tells
 * search engines the page is a duplicate of the homepage.
 */
export function pageMetadata(path: string, opts: { fileImages?: boolean } = {}): Metadata {
  const page = getPage(path);
  // fileImages: the segment has opengraph-image / twitter-image files (blog articles), so the
  // config images are omitted and Next's file-based convention supplies them.
  const images = !opts.fileImages;
  return {
    title: page.path === '/' ? { absolute: page.title } : page.title,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      type: page.ogType ?? 'website',
      url: absoluteUrl(page.path),
      siteName: SITE_NAME,
      title: renderedTitle(page),
      description: page.description,
      locale: 'en_US',
      // Explicit: a page-level openGraph object replaces the file-convention image.
      ...(images ? { images: [{ url: `/opengraph-image?v=${OG_VERSION}`, ...OG_SIZE, alt: OG_ALT }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: renderedTitle(page),
      description: page.description,
      ...(images ? { images: [{ url: `/twitter-image?v=${OG_VERSION}`, ...OG_SIZE, alt: OG_ALT }] } : {}),
    },
  };
}

type JsonLdNode = Record<string, unknown>;

export const authorRef = { '@id': `${SITE_URL}/#author` };
export const orgRef = { '@id': `${SITE_URL}/#org` };

export function breadcrumbList(trail: { name: string; path: string }[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}

export function faqPage(faqs: { q: string; a: string }[]): JsonLdNode {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** VideoObject for the home page promo (self-hosted mp4, click to play, so no embedUrl). */
export function videoObject(): JsonLdNode {
  return {
    '@type': 'VideoObject',
    name: PROMO_VIDEO.title,
    description: PROMO_VIDEO.caption,
    thumbnailUrl: absoluteUrl(PROMO_VIDEO.poster),
    contentUrl: absoluteUrl(PROMO_VIDEO.src),
    uploadDate: PROMO_VIDEO.uploadDate,
    duration: PROMO_VIDEO.duration,
    inLanguage: 'en',
  };
}

export function howTo(opts: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
  totalTime?: string; // ISO 8601 duration, e.g. 'PT2M'
}): JsonLdNode {
  return {
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    ...(opts.totalTime ? { totalTime: opts.totalTime } : {}),
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

/** Article node for a registered page; author/publisher resolve to the root-layout entities. */
export function article(path: string): JsonLdNode {
  const page = getPage(path);
  return {
    '@type': 'Article',
    headline: page.title,
    description: page.description,
    mainEntityOfPage: absoluteUrl(page.path),
    datePublished: page.published ?? PUBLISHED_DATE,
    dateModified: page.updated,
    author: authorRef,
    publisher: orgRef,
    inLanguage: 'en',
  };
}

export function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/** Serialise for an inline <script>; escapes '<' so content can never close the tag. */
export const jsonLdString = (data: JsonLdNode): string =>
  JSON.stringify(data).replace(/</g, '\\u003c');

/** Stable `@id` for a per-page node, e.g. nodeId('/install', 'webpage'). */
export const nodeId = (path: string, fragment: string): string => `${SITE_URL}${path}#${fragment}`;

export const websiteRef = { '@id': `${SITE_URL}/#website` };
export const appRef = { '@id': `${SITE_URL}/#app` };

/**
 * WebPage node for a registered page. Links to the site-wide WebSite/SoftwareApplication
 * entities and to the page's BreadcrumbList (give that node `@id: nodeId(path, 'breadcrumb')`).
 * `opts.type` overrides the node type (for example 'CollectionPage'); `opts.about` overrides the
 * default `about` (the app), for example `{ '@id': nodeId(path, 'film') }` on a film page.
 */
export function webPage(path: string, opts: { type?: string; about?: { '@id': string } } = {}): JsonLdNode {
  const page = getPage(path);
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': nodeId(path, 'webpage'),
    url: absoluteUrl(page.path),
    name: renderedTitle(page),
    description: page.description,
    isPartOf: websiteRef,
    about: opts.about ?? appRef,
    inLanguage: 'en',
    datePublished: page.published ?? PUBLISHED_DATE,
    dateModified: page.updated,
    breadcrumb: { '@id': nodeId(path, 'breadcrumb') },
  };
}

// ---------------------------------------------------------------------------
// Blog builders (spec 4.5). SIGNATURES (T4 codes against these):
//
//   blogPosting(path: string, input: BlogPostingInput): JsonLdNode
//     path   the article path, e.g. '/blog/red-notice-2021' (must be the same path passed to
//            webPage / breadcrumbList; ids are nodeId(path, 'article' | 'webpage' | 'film')).
//     input  { headline, description, published, updated, wordCount }
//            headline = the article h1; published/updated = YYYY-MM-DD (registry values).
//
//   movie(film: Film, path?: string): JsonLdNode
//     film   Film from lib/blog/types; path defaults to `/blog/${film.slug}`.
//
//   Companion graph for one article page:
//     webPage(path, { about: { '@id': nodeId(path, 'film') } }),
//     { ...breadcrumbList([...]), '@id': nodeId(path, 'breadcrumb') },
//     blogPosting(path, ...), movie(film)
//   Hub: webPage('/blog', { type: 'CollectionPage' }); its Dataset node uses
//     `@id: BLOG_DATASET_ID` and `name: BLOG_DATASET_NAME`.
//
// Never emitted here or in the blog graph: aggregateRating, Review, FAQPage, HowTo,
// additionalProperty, image.
// ---------------------------------------------------------------------------

export const BLOG_PATH = '/blog';
export const BLOG_DATASET_ID = `${SITE_URL}${BLOG_PATH}#dataset`;
export const BLOG_DATASET_NAME = 'Top 100 Netflix films: IMDb and Rotten Tomatoes scores';
/** Dataset description, shared by the hub's Dataset node and every BlogPosting.isBasedOn (I11). */
export const BLOG_DATASET_DESCRIPTION =
  "The 100 most-watched films in Netflix's published Top 10 data, ranked by hours viewed, with the IMDb rating and Rotten Tomatoes percentage of each as returned by OMDb.";

export interface BlogPostingInput {
  headline: string;
  description: string;
  /** YYYY-MM-DD */
  published: string;
  /** YYYY-MM-DD, never earlier than `published`. */
  updated: string;
  wordCount: number;
}

export function blogPosting(path: string, input: BlogPostingInput): JsonLdNode {
  // The hub page constant, not getPage: articles exist only with a ready (registered) hub.
  const hub = BLOG_HUB_PAGE;
  return {
    '@type': 'BlogPosting',
    '@id': nodeId(path, 'article'),
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: { '@id': nodeId(path, 'webpage') },
    datePublished: input.published,
    dateModified: input.updated,
    author: authorRef,
    publisher: orgRef,
    about: { '@id': nodeId(path, 'film') },
    // Inline (not bare refs): the hub page defines these nodes, this page does not.
    isPartOf: {
      '@type': 'CollectionPage',
      '@id': nodeId(BLOG_PATH, 'webpage'),
      name: renderedTitle(hub),
      url: absoluteUrl(BLOG_PATH),
    },
    isBasedOn: {
      '@type': 'Dataset',
      '@id': BLOG_DATASET_ID,
      name: BLOG_DATASET_NAME,
      description: BLOG_DATASET_DESCRIPTION,
      url: absoluteUrl(BLOG_PATH),
    },
    inLanguage: 'en',
    wordCount: input.wordCount,
  };
}

const known = (values: readonly string[]): string[] => values.map((v) => v.trim()).filter((v) => v && v !== 'N/A');
const person = (name: string): JsonLdNode => ({ '@type': 'Person', name });

/** Movie node from OMDb facts only. No ratings, no poster, no availability. N/A fields are omitted. */
export function movie(film: Film, path: string = `/blog/${film.slug}`): JsonLdNode {
  const { omdb } = film;
  const genres = known(omdb.genres);
  const directors = known(omdb.directors).slice(0, 2);
  const actors = known(omdb.actors).slice(0, 4);
  return {
    '@type': 'Movie',
    '@id': nodeId(path, 'film'),
    name: displayTitle(omdb.title),
    ...(omdb.released ? { datePublished: omdb.released } : {}),
    ...(omdb.runtimeMin > 0 ? { duration: `PT${omdb.runtimeMin}M` } : {}),
    ...(genres.length ? { genre: genres } : {}),
    ...(directors.length ? { director: directors.map(person) } : {}),
    ...(actors.length ? { actor: actors.map(person) } : {}),
    sameAs: `https://www.imdb.com/title/${omdb.imdbId}/`,
  };
}

/**
 * Site-wide entity graph rendered by the root layout on every page: Person, WebSite,
 * Organization, SoftwareApplication. Per-page nodes (WebPage, Article, ...) reference these by `@id`.
 */
export function siteGraph(): JsonLdNode {
  return graph(
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#author`,
      name: AUTHOR_NAME,
      url: absoluteUrl('/about'),
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: HOME_DESCRIPTION,
      publisher: orgRef,
      about: appRef,
      inLanguage: 'en',
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: SITE_URL,
      description:
        'Maker of Rating Watch, a free browser extension that adds IMDb and Rotten Tomatoes scores to Netflix.',
      founder: authorRef,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      applicationCategory: 'BrowserApplication',
      applicationSubCategory: 'Browser extension',
      operatingSystem: 'Any (runs in Chromium-based browsers: Chrome, Edge, Brave)',
      browserRequirements:
        'Requires a Chromium-based desktop browser with Manifest V3 extension support; installed via Load unpacked in Developer mode.',
      description: HOME_DESCRIPTION,
      url: SITE_URL,
      installUrl: absoluteUrl('/install'),
      downloadUrl: absoluteUrl(EXTENSION_ZIP_PATH),
      softwareVersion: manifest.version,
      datePublished: PUBLISHED_DATE,
      dateModified: LAST_UPDATED,
      isAccessibleForFree: true,
      inLanguage: 'en',
      author: authorRef,
      publisher: orgRef,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'IMDb ratings on every Netflix title card',
        'Rotten Tomatoes critic scores',
        'Parallel loading of all visible cards',
        'Extension needs no account or login',
        'Extension is privacy-friendly with no tracking',
      ],
    },
  );
}
