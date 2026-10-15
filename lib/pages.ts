// Single registry of every public page. The sitemap, per-page metadata, footer
// "Guides" links and (later) llms.txt all read from here, so a new page is
// listed everywhere by adding exactly one entry — no page can be an orphan.

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
}

export const HOME_TITLE = 'Netflix Ratings: IMDb & Rotten Tomatoes on Netflix Cards';
export const HOME_DESCRIPTION =
  'Free, open-source Chrome extension that shows IMDb and Rotten Tomatoes ratings on Netflix title cards as you browse. No account, no tab-switching.';

export const PAGES: SitePage[] = [
  {
    path: '/',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    updated: '2026-10-15',
    changeFrequency: 'weekly',
    priority: 1,
    ogType: 'website',
    label: 'Home',
  },
  {
    path: '/install',
    title: 'Install Netflix Ratings on Chrome, Edge, Brave',
    description:
      'Install the free Netflix Ratings extension in about a minute: download from GitHub, enable Developer mode, click Load unpacked. Works in Chrome, Edge and Brave.',
    published: '2026-10-15',
    updated: '2026-10-15',
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
      'Show IMDb ratings on Netflix cards with the free Netflix Ratings extension: install, open Netflix, read the top-right badge. What the score means, and limits.',
    published: '2026-10-15',
    updated: '2026-10-15',
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
      'Netflix has no Rotten Tomatoes scores. Install the free Netflix Ratings extension to see the Tomatometer on every title card, and what the percentage means.',
    published: '2026-10-15',
    updated: '2026-10-15',
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
    updated: '2026-10-15',
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
    updated: '2026-10-15',
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
    updated: '2026-10-15',
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
      'Netflix Ratings vs Reelgood, JustWatch, IMDb, Rotten Tomatoes and other extensions for seeing ratings on Netflix. A fair table, with sources, verified Oct 2026.',
    published: '2026-10-15',
    updated: '2026-10-15',
    changeFrequency: 'monthly',
    priority: 0.8,
    group: 'compare',
    label: 'Rating alternatives',
    ogType: 'article',
  },
  {
    path: '/about',
    title: 'About Netflix Ratings and Its Maker',
    description:
      'Netflix Ratings is a free open-source extension made by Igor Gazivoda. Where the scores come from, how accuracy is handled, and how to reach the maker.',
    published: '2026-10-15',
    updated: '2026-10-15',
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
    updated: '2026-06-17',
    changeFrequency: 'monthly',
    priority: 0.5,
    group: 'about',
    label: 'Camera Vision demo',
    ogType: 'website',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    description:
      'What the Netflix Ratings extension sends (only title names, to OMDb), what it never collects, and the browser permissions it asks for. No account, no tracking.',
    updated: '2026-06-17',
    changeFrequency: 'yearly',
    priority: 0.3,
    group: 'legal',
    label: 'Privacy',
    ogType: 'website',
  },
];

export const getPage = (path: string): SitePage => {
  const page = PAGES.find((p) => p.path === path);
  if (!page) throw new Error(`No page registered for ${path}`);
  return page;
};

export const pagesInGroup = (group: NonNullable<SitePage['group']>): SitePage[] =>
  PAGES.filter((p) => p.group === group);
