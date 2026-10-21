// Shared homepage content. Kept in one place so on-page copy and the
// JSON-LD structured data (FAQPage, SoftwareApplication) never drift apart.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://rating.watch';

import { PRO_ON_SALE } from './billing/flag';

export const SUPPORT_EMAIL = 'hello@rating.watch';

// ---------------------------------------------------------------------------------------------
// LEGAL IDENTITY (privacy policy, terms and the Paddle review all want a named seller). Each block renders
// on /privacy and /terms ONLY when its constant is a non-empty string, so an empty one never prints a blank
// line or a placeholder.
//   LEGAL_ENTITY   the operator: an individual (sole proprietor) trading as Rating Watch
//   LEGAL_ADDRESS  postal address of that operator, one line, e.g. '1 Main St, 11000 Belgrade, Serbia'
//   GOVERNING_LAW  governing law and venue sentence, e.g. 'the laws of Serbia' (rendered after "governed by")
//
// TODO(pre-launch): LEGAL_ADDRESS and GOVERNING_LAW are still empty. They block turning billing on:
// `npm run billing:readiness` (lib/billing/readiness.ts) reports each empty one as a blocker as soon as billing is
// configured. Fill them in, then the check passes. Do not put a placeholder here.
// ---------------------------------------------------------------------------------------------
export const LEGAL_ENTITY: string = 'Igor Gazivoda';
export const LEGAL_ADDRESS: string = ''; // TODO(pre-launch): postal address of the operator
export const GOVERNING_LAW: string = ''; // TODO(pre-launch): governing law and venue

// Pro (AR mode) pricing in one place. The FAQ, the SoftwareApplication offers in JSON-LD and
// llms.txt read it (all gated on PRO_ON_SALE, so nothing prerendered offers Pro before it can be bought); tests/billing/copy-accuracy.test.ts checks it against lib/billing/client.ts PRICES.
export const PRO_PRICING = {
  monthly: '2.99',
  yearly: '29',
  currency: 'USD',
  trialDays: 3,
} as const;

// Hosted on this site (public/downloads); scripts/package-extension.sh refreshes it.
export const EXTENSION_ZIP_PATH = '/downloads/rating-watch-extension.zip';

// Author + freshness signals. Surfaced as a visible byline/date on pages and in
// the JSON-LD graph (Person, datePublished/dateModified) so AI search engines
// and AI Overviews can attribute and date the content.
export const AUTHOR_NAME = 'Igor Gazivoda';
export const PUBLISHED_DATE = '2026-05-01'; // first public release
// Date of the newest real content change on any static page. tests/lib/pages-dates.test.ts fails
// when it falls behind the per-page dates in lib/pages.ts (PAGE_UPDATED), so it cannot drift.
export const LAST_UPDATED = '2026-10-21'; // ISO
export const LAST_UPDATED_LABEL = 'October 21, 2026';

export const FEATURES = [
  {
    icon: '01',
    title: 'IMDb scores on title cards',
    desc: 'Title cards show the IMDb rating from the OMDb database, refreshed up to weekly. No guessing, no leaving Netflix.',
  },
  {
    icon: '02',
    title: 'Rotten Tomatoes where available',
    desc: 'When OMDb has a Tomatometer score for a title, it sits right beside the IMDb number. Films usually have one; TV series often do not.',
  },
  {
    icon: '03',
    title: 'Loads in parallel',
    desc: 'Every visible card fetches its rating at once. Scroll, and the next batch fires automatically, with no waiting card by card.',
  },
  {
    icon: '04',
    title: 'Private by default',
    desc: 'The extension needs no account or login and has no analytics. It only talks to the ratings source, OMDb, so your watch history stays yours. This website measures visits only if you accept analytics in the cookie banner.',
  },
  {
    icon: '05',
    title: 'Fits right in',
    desc: 'A subtle badge in the corner of each card. It matches the Netflix UI without covering artwork or breaking your flow.',
  },
  {
    icon: '06',
    title: 'Covers new rows',
    desc: 'Badges follow you as you browse: new rows, search results, “More Like This.” Looked-up scores are cached on your device for up to a week.',
  },
];

export const STATS = [
  { value: '2', label: 'rating sources', sub: 'IMDb, plus Rotten Tomatoes where OMDb has it' },
  { value: '0', label: 'accounts needed for the extension', sub: 'no login needed' },
  { value: '2', label: 'sites it can access', sub: 'netflix.com + omdbapi.com' },
  { value: '$0', label: 'cost of the extension', sub: 'free, no card needed' },
];

// One table of illustrative scores for every mock-up on the home page (hero cards, marquee,
// before/after, compare box), so the same title never shows two different numbers. The values
// for films are the OMDb figures in public/data/imdb-rt-gap.json (fetched 2026-10-15). OMDb
// returned no Rotten Tomatoes score for any TV series in that study, so a series carries IMDb only.
export interface ShowcaseScore {
  imdb: string;
  /** Absent when OMDb has no Rotten Tomatoes score, which is the usual case for TV series. */
  rt?: string;
}

export const SHOWCASE: Record<string, ShowcaseScore> = {
  Roma: { imdb: '7.6', rt: '96%' },
  'The Irishman': { imdb: '7.8', rt: '95%' },
  'Marriage Story': { imdb: '7.9', rt: '95%' },
  Klaus: { imdb: '8.2', rt: '95%' },
  Okja: { imdb: '7.3', rt: '87%' },
  Mudbound: { imdb: '7.4', rt: '97%' },
  'Enola Holmes': { imdb: '6.7', rt: '91%' },
  Extraction: { imdb: '6.8', rt: '67%' },
  'Bird Box': { imdb: '6.6', rt: '64%' },
  'Red Notice': { imdb: '6.3', rt: '36%' },
  Hustle: { imdb: '7.3', rt: '94%' },
  Nimona: { imdb: '7.5', rt: '92%' },
  // A series: IMDb only, as the extension would show it.
  'Stranger Things': { imdb: '8.7' },
};

// Titles for the auto-scrolling marquee strip. Scores are illustrative.
export const MARQUEE: Array<{ title: string } & ShowcaseScore> = [
  'Roma',
  'The Irishman',
  'Klaus',
  'Stranger Things',
  'Okja',
  'Mudbound',
  'Enola Holmes',
  'Extraction',
  'Marriage Story',
  'Bird Box',
  'Hustle',
  'Red Notice',
  'Nimona',
].map((title) => ({ title, ...SHOWCASE[title] }));

// Pro wording appears only when Pro is on sale (build-time flag, see lib/billing/flag.ts); otherwise AR mode is described as
// free to try, which is what the app does while billing is off.
export const AR_MODE_NAME = PRO_ON_SALE ? 'Pro AR mode' : 'AR mode';

export function buildFaqs(onSale: boolean) {
  return [
  {
    q: 'What is Rating Watch?',
    a: `Rating Watch is a free Chrome extension that shows the IMDb rating, and the Rotten Tomatoes score where one exists, in a small badge on each Netflix title card as you browse. You see the scores without opening another tab or searching anything. It runs on netflix.com in Chromium browsers such as Chrome, Edge and Brave. ${onSale ? 'There is also an optional Pro AR mode that shows scores over a TV screen through your phone camera.' : 'There is also an experimental AR mode that shows scores over a TV screen through your phone camera.'}`,
  },
  {
    q: 'Is Rating Watch free?',
    a: onSale
      ? `The Chrome extension is free: no account and nothing to subscribe to. AR mode, which draws ratings over your TV through your phone camera, is Pro: $${PRO_PRICING.monthly} a month or $${PRO_PRICING.yearly} a year, with a ${PRO_PRICING.trialDays}-day free trial that needs no card. You can cancel any time from your account page.`
      : 'The Chrome extension is free: no account and nothing to subscribe to. AR mode, which draws ratings over your TV through your phone camera, is free to try for now. A paid plan for it is not on sale yet.',
  },
  {
    q: 'Where do the ratings come from?',
    a: 'Ratings come from OMDb, the Open Movie Database. The extension looks up each Netflix title by name through the OMDb API and reads the IMDb rating and Rotten Tomatoes score OMDb returns. The scores are not calculated or edited by Rating Watch, so they match what OMDb has on file for that title.',
  },
  {
    q: 'How is the Rotten Tomatoes score defined?',
    a: 'The Tomatometer is the percentage of professional critic reviews that are positive, according to Rotten Tomatoes. It is a head-count, not an average of how good the reviews were. A title is labelled Fresh when at least 60% of reviews are positive and Rotten below that. The IMDb number is a separate 1 to 10 audience rating.',
  },
  {
    q: 'Does it show ratings for every title?',
    a: 'No. A title OMDb can match gets its IMDb rating, but the Rotten Tomatoes score is mostly available for films. In our own data study, OMDb returned no Rotten Tomatoes score for any Netflix series, so series cards usually show IMDb only. Very new releases and titles whose Netflix name differs from the database listing can show no badge at all.',
  },
  {
    q: 'Do I need an API key?',
    a: 'No key is needed to start. The extension works out of the box using a shared OMDb lookup allowance (1,000 requests a day across all users), so on a busy day ratings can pause and the toolbar icon shows a red exclamation mark. You can add a free personal OMDb key in the extension options page to use your own daily allowance instead.',
  },
  {
    q: 'Does it work on the Netflix mobile app or TV?',
    a: `No. Rating Watch is a browser extension, and its manifest only covers www.netflix.com, so it works when you browse Netflix on a computer in Chrome, Edge, Brave or another Chromium browser. Browser extensions do not run inside the Netflix app on phones, tablets, smart TVs or game consoles, so no badges appear there. ${onSale ? 'AR mode (Pro)' : 'AR mode'} is the way to get scores for a TV, through your phone camera.`,
  },
  {
    q: 'Does it slow Netflix down?',
    a: 'It is designed not to. The extension only adds a small text badge to title cards, waits 300 milliseconds after the page changes before scanning, fetches ratings in a background worker in parallel, and caches repeat lookups locally. It does not touch video playback. We have not published benchmark numbers.',
  },
  {
    q: 'Is Rating Watch affiliated with Netflix?',
    a: 'No. Rating Watch is an independent project by Igor Gazivoda and is not affiliated with, endorsed by or sponsored by Netflix, IMDb or Rotten Tomatoes. Netflix, IMDb and Rotten Tomatoes are trademarks of their respective owners. The extension only reads the title cards that your own browser already displays.',
  },
  {
    q: 'Does the extension collect my data?',
    a: 'It has no account, no analytics and does not read your viewing history. To look up a rating it sends the title text and the OMDb API key to omdbapi.com, so OMDb can see your IP address like any site you connect to. Looked-up scores are cached in the extension’s private browser database on your device. Its permissions are limited to netflix.com and omdbapi.com.',
  },
  {
    q: 'How do I install Rating Watch?',
    a: 'It is a free download that you add to Chrome yourself, because it is not on the Chrome Web Store yet. Download the zip from the install page, unzip it, open chrome://extensions, turn on Developer mode, click Load unpacked and choose the unzipped folder. Then open netflix.com and the badges appear on title cards. The whole process takes about a minute.',
  },
  ];
}

export const FAQS = buildFaqs(PRO_ON_SALE);
