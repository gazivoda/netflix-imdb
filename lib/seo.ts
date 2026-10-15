// Pure SEO/GEO helpers: metadata + JSON-LD builders. No JSX, so they are unit
// testable in a node environment (see tests/lib/seo.test.ts).

import type { Metadata } from 'next';
import { SITE_URL, PUBLISHED_DATE } from './content';
import { getPage, type SitePage } from './pages';

export const SITE_NAME = 'Netflix Ratings';
export const TITLE_SUFFIX = ' · Netflix Ratings';

export const absoluteUrl = (path: string): string => `${SITE_URL}${path}`;

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
    },
    twitter: {
      card: 'summary_large_image',
      title: renderedTitle(page),
      description: page.description,
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
