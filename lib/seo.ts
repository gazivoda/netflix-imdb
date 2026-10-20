// Pure SEO/GEO helpers: metadata + JSON-LD builders. No JSX, so they are unit
// testable in a node environment (see tests/lib/seo.test.ts).

import type { Metadata } from 'next';
import { SITE_URL, REPO_URL, AUTHOR_NAME, PUBLISHED_DATE, LAST_UPDATED } from './content';
import { getPage, HOME_DESCRIPTION, type SitePage } from './pages';
import manifest from '../extension/manifest.json';
import { OG_SIZE, OG_ALT, OG_VERSION } from './og';

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
export function pageMetadata(path: string): Metadata {
  const page = getPage(path);
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
      images: [{ url: `/opengraph-image?v=${OG_VERSION}`, ...OG_SIZE, alt: OG_ALT }],
    },
    twitter: {
      card: 'summary_large_image',
      title: renderedTitle(page),
      description: page.description,
      images: [{ url: `/twitter-image?v=${OG_VERSION}`, ...OG_SIZE, alt: OG_ALT }],
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
 */
export function webPage(path: string): JsonLdNode {
  const page = getPage(path);
  return {
    '@type': 'WebPage',
    '@id': nodeId(path, 'webpage'),
    url: absoluteUrl(page.path),
    name: renderedTitle(page),
    description: page.description,
    isPartOf: websiteRef,
    about: appRef,
    inLanguage: 'en',
    datePublished: page.published ?? PUBLISHED_DATE,
    dateModified: page.updated,
    breadcrumb: { '@id': nodeId(path, 'breadcrumb') },
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
      url: REPO_URL,
      sameAs: ['https://github.com/gazivoda'],
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
        'Maker of Rating Watch, a free open-source browser extension that adds IMDb and Rotten Tomatoes scores to Netflix.',
      founder: authorRef,
      sameAs: [REPO_URL],
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
      downloadUrl: REPO_URL,
      softwareVersion: manifest.version,
      datePublished: PUBLISHED_DATE,
      dateModified: LAST_UPDATED,
      isAccessibleForFree: true,
      inLanguage: 'en',
      author: authorRef,
      publisher: orgRef,
      sameAs: [REPO_URL],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'IMDb ratings on every Netflix title card',
        'Rotten Tomatoes critic scores',
        'Parallel loading of all visible cards',
        'No account or login required',
        'Privacy-friendly, no tracking',
      ],
    },
  );
}
