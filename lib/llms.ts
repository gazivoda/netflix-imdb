// Builders for /llms.txt and /llms-full.txt. Pure functions over the page
// registry, so a new registry entry shows up in both files automatically.
// llms.txt is an unofficial convention that some AI tools read; Google Search
// does not use it. It is cheap to generate, so we keep it accurate and small.

import { SITE_URL, AUTHOR_NAME, FAQS } from './content';
import { absoluteUrl } from './seo';
import manifest from '../extension/manifest.json';
import { PAGES, type SitePage } from './pages';
import { formatAsOf, formatImdb, formatSigned } from './blog/format';

const SITE_NAME = 'Rating Watch';

const SUMMARY =
  'Rating Watch is a free Chrome extension that shows IMDb and Rotten Tomatoes ratings on Netflix title cards as you browse. Not affiliated with Netflix, IMDb or Rotten Tomatoes.';

// Verified against extension/ (manifest.json, content.js, background.js).
const KEY_FACTS = [
  'Shows the IMDb rating (out of 10) and the Rotten Tomatoes percentage in a badge at the top-right of each title card on www.netflix.com.',
  'Ratings are fetched from OMDb by the extension background worker.',
  `Manifest V3 extension, version ${manifest.version}. Permissions are limited to netflix.com and omdbapi.com.`,
  'The Chrome extension is free and needs no account. AR mode is Pro ($2.99/month or $29/year, 3-day free trial); see /pricing.',
  'Not on the Chrome Web Store yet: install by downloading the zip from this site and using "Load unpacked" in chrome://extensions.',
  'Works in Chromium browsers (Chrome, Edge, Brave). Not tested in Firefox or Safari.',
  `Author: ${AUTHOR_NAME}.`,
];

interface Section {
  heading: string;
  pages: SitePage[];
}

const url = (path: string): string => absoluteUrl(path);

// Registry group -> llms.txt section. "Optional" is the spec's name for pages
// a reader may skip when short on context.
export function sectionsFor(pages: SitePage[] = PAGES): Section[] {
  // Blog film analyses (kind 'article') are listed only in llms-full.txt "Film analyses".
  const rest = pages.filter((p) => p.path !== '/' && p.kind !== 'article');
  const by = (pred: (p: SitePage) => boolean) => rest.filter(pred);
  return [
    { heading: 'Docs', pages: pages.filter((p) => p.path === '/') },
    { heading: 'Guides', pages: by((p) => p.group === 'guide') },
    { heading: 'Comparisons', pages: by((p) => p.group === 'compare') },
    { heading: 'Project', pages: by((p) => !p.group || p.group === 'about') },
    { heading: 'Optional', pages: by((p) => p.group === 'legal') },
  ].filter((s) => s.pages.length > 0);
}

const entry = (p: SitePage): string =>
  `- [${p.label ?? p.title}](${url(p.path)}): ${p.description}`;

const header = (): string[] => [`# ${SITE_NAME}`, '', `> ${SUMMARY}`, ''];

const keyFacts = (): string[] => ['## Key facts', '', ...KEY_FACTS.map((f) => `- ${f}`), ''];

export const DATASET_PATH = '/data/netflix-top-100.json';

const articlesOf = (pages: SitePage[]): SitePage[] => pages.filter((p) => p.kind === 'article');

// Only present once the blog has published films; with nothing to list the section is omitted.
const dataSection = (pages: SitePage[]): string[] =>
  articlesOf(pages).length > 0
    ? [
        '## Data',
        '',
        `- [Top 100 Netflix films dataset (JSON)](${url(DATASET_PATH)}): IMDb and Rotten Tomatoes scores for the 100 most-watched Netflix films, with the selection rule and sources.`,
        '',
      ]
    : [];

// One compact line per published article: `- [Title (Year)](url): IMDb x, RT y%, gap z, scores as of d`.
const filmAnalysesSection = (pages: SitePage[]): string[] => {
  const articles = articlesOf(pages);
  if (articles.length === 0) return [];
  return [
    '## Film analyses',
    '',
    ...articles.map((p) => {
      const sc = p.scores;
      const facts = sc
        ? `: IMDb ${formatImdb(sc.imdb)}, RT ${sc.rt}%, gap ${formatSigned(sc.gap)}, scores as of ${formatAsOf(sc.asOf)}`
        : '';
      return `- [${p.label ?? p.title}](${url(p.path)})${facts}`;
    }),
    '',
  ];
};

export function buildLlmsTxt(pages: SitePage[] = PAGES): string {
  const lines = [...header(), ...keyFacts()];
  for (const s of sectionsFor(pages)) {
    lines.push(`## ${s.heading}`, '', ...s.pages.map(entry), '');
  }
  lines.push(...dataSection(pages));
  return lines.join('\n').trimEnd() + '\n';
}

export function buildLlmsFullTxt(
  pages: SitePage[] = PAGES,
  faqs: ReadonlyArray<{ q: string; a: string }> = FAQS,
): string {
  const lines = [
    ...header(),
    `Full version of ${url('/llms.txt')}. Site: ${SITE_URL}`,
    '',
    ...keyFacts(),
  ];
  for (const s of sectionsFor(pages)) {
    lines.push(`## ${s.heading}`, '');
    for (const p of s.pages) {
      lines.push(
        `### ${p.title}`,
        '',
        `URL: ${url(p.path)}`,
        `Last updated: ${p.updated}`,
        '',
        p.description,
        '',
      );
    }
  }
  lines.push(...filmAnalysesSection(pages));
  lines.push(`## Frequently asked questions (from ${url('/')})`, '');
  for (const f of faqs) lines.push(`### ${f.q}`, '', f.a, '');
  lines.push(...dataSection(pages));
  return lines.join('\n').trimEnd() + '\n';
}

// Hourly browser cache, day-long shared cache with background revalidation.
// The body only changes on deploy, so this stays cheap and never stale for long.
export const LLMS_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
} as const;
