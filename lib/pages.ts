// Single registry of every public page. The sitemap, per-page metadata, footer
// "Guides" links and (later) llms.txt all read from here, so a new page is
// listed everywhere by adding exactly one entry — no page can be an orphan.

import { BLOG_ARTICLE_PAGES, BLOG_HUB, type BlogArticlePage, type BlogHubState } from './blog/registry.generated';

export type ChangeFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface SitePage {
  path: string;
  /** Page title WITHOUT the site suffix (the root layout template appends it). */
  title: string;
  description: string;
  /** ISO date first published; defaults to the site's PUBLISHED_DATE. */
  published?: string;
  /** ISO date of the last real content edit — drives sitemap <lastmod>. */
  updated: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  /** Which footer/nav group links to this page; omit to keep it out of nav. */
  group?: 'guide' | 'compare' | 'legal' | 'about';
  /** Short anchor text for nav/footer links. */
  label?: string;
  /** OpenGraph type. */
  ogType?: 'website' | 'article';
  /**
   * 'article' marks a blog film analysis (/blog/{slug}): in the sitemap and llms-full.txt, but
   * not in the footer or the llms.txt sections (there are too many); metadata uses file-based images.
   */
  kind?: 'article';
  /** Article pages only: the scores shown in llms-full.txt (from the generated registry). */
  scores?: BlogArticlePage['scores'];
}

/**
 * Real last content change per static page (ISO date). This is the only place to bump a page's
 * date: the sitemap <lastmod>, the visible "Updated" byline, Article/WebPage dateModified and
 * llms-full.txt all read it through the registry below. Change it only when the page's visible
 * copy really changes, never to look fresh. tests/lib/pages-dates.test.ts ties LAST_UPDATED
 * (lib/content.ts) to the newest date here.
 */
export const PAGE_UPDATED: Record<string, string> = {
  '/': '2026-10-21', // testimonials removed, rating-source and download wording corrected
  '/install': '2026-10-21', // shared-allowance and personal-key notes added
  '/how-to/show-imdb-ratings-on-netflix': '2026-10-21',
  '/how-to/show-rotten-tomatoes-on-netflix': '2026-10-21', // description corrected (not every card has RT)
  '/how-to/find-what-to-watch-on-netflix': '2026-10-21',
  '/research/imdb-vs-rotten-tomatoes-gap': '2026-10-20',
  '/compare/imdb-vs-rotten-tomatoes': '2026-10-21',
  '/compare/alternatives': '2026-10-21',
  '/about': '2026-10-21',
  '/camera-vision': '2026-10-20',
  '/camera-vision/ar': '2026-10-20',
  '/privacy': '2026-10-21',
  '/pricing': '2026-10-21', // edited on 2026-10-21 by the pricing fixer
  '/terms': '2026-10-21',
  '/refund-policy': '2026-10-21',
};

export const HOME_TITLE = 'Rating Watch: IMDb & Rotten Tomatoes on Netflix Cards';
export const HOME_DESCRIPTION =
  'Free Chrome extension that shows IMDb ratings, and Rotten Tomatoes scores where available, on Netflix title cards as you browse. The extension needs no account.';

/**
 * The /blog hub. Registered (sitemap, footer, llms.txt) only when the generated registry says the
 * hub is ready, that is films.json holds the expected number of films (I9). Until then the route
 * is a 404 and nothing links to it.
 */
export const BLOG_HUB_PAGE: SitePage = {
    path: '/blog',
    title: 'Top 100 Netflix Films Rated by Critics and Fans',
    description:
      'The 100 most-watched Netflix films with IMDb and Rotten Tomatoes scores side by side, where critics and audiences split most, and how the list is built.',
    published: '2026-10-20',
    updated: '2026-10-20',
    changeFrequency: 'monthly',
    priority: 0.7,
    group: 'guide',
    label: 'Blog',
    ogType: 'article',
  };

/** Static pages; the hub is inserted after this path when ready, so the footer order is stable. */
const BLOG_HUB_AFTER = '/research/imdb-vs-rotten-tomatoes-gap';

export const STATIC_PAGES: SitePage[] = [
  {
    path: '/',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    updated: PAGE_UPDATED['/'],
    changeFrequency: 'weekly',
    priority: 1,
    ogType: 'website',
    label: 'Home',
  },
  {
    path: '/install',
    title: 'Install Rating Watch on Chrome, Edge, Brave',
    description:
      'Install the free Rating Watch extension in about a minute: download the zip, enable Developer mode, click Load unpacked. Works in Chrome, Edge and Brave.',
    published: '2026-10-15',
    updated: PAGE_UPDATED['/install'],
    changeFrequency: 'monthly',
    priority: 0.9,
    group: 'guide',
    label: 'How to install',
    ogType: 'article',
  },
  {
    path: '/how-to/show-imdb-ratings-on-netflix',
    title: 'How to Show IMDb Ratings on Netflix (Free)',
    description:
      'Show IMDb ratings on Netflix cards with the free Rating Watch extension: install, open Netflix, read the top-right badge. What the score means, and limits.',
    published: '2026-10-15',
    updated: PAGE_UPDATED['/how-to/show-imdb-ratings-on-netflix'],
    changeFrequency: 'monthly',
    priority: 0.9,
    group: 'guide',
    label: 'Show IMDb ratings on Netflix',
    ogType: 'article',
  },
  {
    path: '/how-to/show-rotten-tomatoes-on-netflix',
    title: 'Show Rotten Tomatoes Scores on Netflix',
    description:
      'Netflix has no Rotten Tomatoes scores. Install the free Rating Watch extension to see the Tomatometer where OMDb has one, and what the percentage means.',
    published: '2026-10-15',
    updated: PAGE_UPDATED['/how-to/show-rotten-tomatoes-on-netflix'],
    changeFrequency: 'monthly',
    priority: 0.9,
    group: 'guide',
    label: 'Show Rotten Tomatoes on Netflix',
    ogType: 'article',
  },
  {
    path: '/how-to/find-what-to-watch-on-netflix',
    title: 'How to Find What to Watch on Netflix',
    description:
      'A 60-second routine for choosing what to watch on Netflix: read IMDb and Rotten Tomatoes together, spot split scores, and know when ratings mislead.',
    published: '2026-10-15',
    updated: PAGE_UPDATED['/how-to/find-what-to-watch-on-netflix'],
    changeFrequency: 'monthly',
    priority: 0.8,
    group: 'guide',
    label: 'Find what to watch',
    ogType: 'article',
  },
  {
    path: '/research/imdb-vs-rotten-tomatoes-gap',
    title: 'IMDb vs Rotten Tomatoes Gap: Netflix Data Study',
    description:
      'We compared IMDb and Rotten Tomatoes scores for 44 Netflix Original films: the average gap is 18.7 points and 61% differ by 15+. Method and raw data included.',
    published: '2026-10-15',
    updated: PAGE_UPDATED['/research/imdb-vs-rotten-tomatoes-gap'],
    changeFrequency: 'yearly',
    priority: 0.8,
    group: 'guide',
    label: 'IMDb vs RT data study',
    ogType: 'article',
  },
  {
    path: '/compare/imdb-vs-rotten-tomatoes',
    title: 'IMDb vs Rotten Tomatoes: Which Rating to Trust',
    description:
      'IMDb is an audience score out of 10; Rotten Tomatoes is the share of critics who liked it. How the two differ, why they disagree, and when to trust each.',
    published: '2026-06-16',
    updated: PAGE_UPDATED['/compare/imdb-vs-rotten-tomatoes'],
    changeFrequency: 'monthly',
    priority: 0.9,
    group: 'compare',
    label: 'IMDb vs Rotten Tomatoes',
    ogType: 'article',
  },
  {
    path: '/compare/alternatives',
    title: 'Ratings on Netflix: Reelgood, JustWatch & More',
    description:
      'Rating Watch vs Reelgood, JustWatch, IMDb, Rotten Tomatoes and other extensions for seeing ratings on Netflix. A fair table, with sources, verified Oct 2026.',
    published: '2026-10-15',
    updated: PAGE_UPDATED['/compare/alternatives'],
    changeFrequency: 'monthly',
    priority: 0.8,
    group: 'compare',
    label: 'Rating alternatives',
    ogType: 'article',
  },
  {
    path: '/about',
    title: 'About Rating Watch and Its Maker',
    description:
      'Rating Watch is a free browser extension made by Igor Gazivoda. Where the scores come from, how accuracy is handled, and how to reach the maker.',
    published: '2026-10-15',
    updated: PAGE_UPDATED['/about'],
    changeFrequency: 'yearly',
    priority: 0.6,
    group: 'about',
    label: 'About',
    ogType: 'website',
  },
  {
    path: '/camera-vision',
    title: 'Camera Vision Demo: Read Titles by Camera',
    description:
      'Experimental demo that reads movie and show titles from your camera with on-device OCR, then looks up their IMDb and Rotten Tomatoes scores.',
    published: '2026-05-07',
    updated: PAGE_UPDATED['/camera-vision'],
    changeFrequency: 'monthly',
    priority: 0.5,
    group: 'about',
    label: 'Camera Vision demo',
    ogType: 'website',
  },
  {
    path: '/camera-vision/ar',
    title: 'AR Ratings: Netflix Scores Over the TV Screen',
    description:
      'AR mode for Rating Watch Pro: point your camera at a TV showing Netflix and see IMDb and Rotten Tomatoes scores over each tile. 3-day free trial.',
    published: '2026-10-20',
    updated: PAGE_UPDATED['/camera-vision/ar'],
    changeFrequency: 'monthly',
    priority: 0.4,
    ogType: 'website',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    description:
      'What the Rating Watch extension sends to OMDb, what the website stores for AR mode accounts (Google sign-in, Paddle payments) and how opt-in analytics works.',
    updated: PAGE_UPDATED['/privacy'],
    changeFrequency: 'yearly',
    priority: 0.3,
    group: 'legal',
    label: 'Privacy',
    ogType: 'website',
  },
  {
    path: '/pricing',
    title: 'Pricing: Free Extension and Pro AR Mode',
    description:
      'Rating Watch is free as a Chrome extension. Pro adds AR mode for $2.99 a month or $29 a year, with a 3-day free trial and a 14-day refund window.',
    published: '2026-10-20',
    updated: PAGE_UPDATED['/pricing'],
    changeFrequency: 'monthly',
    priority: 0.6,
    group: 'about',
    label: 'Pricing',
    ogType: 'website',
  },
  {
    path: '/terms',
    title: 'Terms of Service',
    description:
      'The terms for using Rating Watch: the free Chrome extension, the Pro AR mode subscription, billing through Paddle, cancellation and acceptable use.',
    published: '2026-10-20',
    updated: PAGE_UPDATED['/terms'],
    changeFrequency: 'yearly',
    priority: 0.3,
    group: 'legal',
    label: 'Terms',
    ogType: 'website',
  },
  {
    path: '/refund-policy',
    title: 'Refund Policy',
    description:
      'Request a full refund within 14 days of your first Rating Watch Pro payment. How to ask, how long it takes and what happens to your access afterwards.',
    published: '2026-10-20',
    updated: PAGE_UPDATED['/refund-policy'],
    changeFrequency: 'yearly',
    priority: 0.3,
    group: 'legal',
    label: 'Refund policy',
    ogType: 'website',
  },
];

/** Blog film analyses from the generated registry (priority 0.5; no group, so not in nav or llms.txt sections). */
export function blogPages(entries: readonly BlogArticlePage[] = BLOG_ARTICLE_PAGES): SitePage[] {
  return entries.map((e) => ({
    path: e.path,
    title: e.title,
    description: e.description,
    published: e.published,
    updated: e.updated,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
    label: e.label,
    ogType: 'article' as const,
    kind: 'article' as const,
    scores: e.scores,
  }));
}

/**
 * STATIC_PAGES + the /blog hub (only when ready) + the blog articles. The hub changes whenever
 * an article is published or edited, or a film's data changes, so its lastmod is the max of its
 * own date, the newest article and max(films dataChangedAt) (I10).
 */
export function buildPages(
  entries: readonly BlogArticlePage[] = BLOG_ARTICLE_PAGES,
  hub: BlogHubState = BLOG_HUB,
): SitePage[] {
  const articles = blogPages(entries);
  if (!hub.ready) {
    if (articles.length) throw new Error('registry has article pages but the blog hub is not ready; run `npm run blog:registry`');
    return [...STATIC_PAGES];
  }
  const updated = [BLOG_HUB_PAGE.updated, hub.dataUpdated ?? '', ...articles.map((p) => p.updated)].reduce((a, b) => (b > a ? b : a));
  const at = STATIC_PAGES.findIndex((p) => p.path === BLOG_HUB_AFTER) + 1;
  return [...STATIC_PAGES.slice(0, at), { ...BLOG_HUB_PAGE, updated }, ...STATIC_PAGES.slice(at), ...articles];
}

export const PAGES: SitePage[] = buildPages();

export const getPage = (path: string): SitePage => {
  const page = PAGES.find((p) => p.path === path);
  if (!page) throw new Error(`No page registered for ${path}`);
  return page;
};

export const pagesInGroup = (group: NonNullable<SitePage['group']>): SitePage[] =>
  PAGES.filter((p) => p.group === group);
