// Shared homepage content. Kept in one place so on-page copy and the
// JSON-LD structured data (FAQPage, SoftwareApplication) never drift apart.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://netflix-ratings.app';

export const REPO_URL = 'https://github.com/gazivoda/netflix-imdb';

// Author + freshness signals. Surfaced as a visible byline/date on pages and in
// the JSON-LD graph (Person, datePublished/dateModified) so AI search engines
// and AI Overviews can attribute and date the content.
export const AUTHOR_NAME = 'Igor Gazivoda';
export const PUBLISHED_DATE = '2026-05-01'; // first public release
export const LAST_UPDATED = '2026-10-15'; // ISO; keep in sync with real edits
export const LAST_UPDATED_LABEL = 'October 15, 2026';

export const FEATURES = [
  {
    icon: '★',
    title: 'Live IMDb scores',
    desc: 'Every title card shows its current IMDb rating, pulled straight from the database. No guessing, no leaving Netflix.',
  },
  {
    icon: '🍅',
    title: 'Rotten Tomatoes too',
    desc: 'Critic scores sit right beside the IMDb number, so you get both the crowd and the critics before you commit.',
  },
  {
    icon: '⚡',
    title: 'Loads in parallel',
    desc: 'Every visible card fetches its rating at once. Scroll, and the next batch fires automatically — no waiting card by card.',
  },
  {
    icon: '🔒',
    title: 'Private by default',
    desc: 'No account, no login, no tracking. The extension only talks to the ratings source — your watch history stays yours.',
  },
  {
    icon: '🎴',
    title: 'Fits right in',
    desc: 'A subtle badge in the corner of each card. It matches the Netflix UI without covering artwork or breaking your flow.',
  },
  {
    icon: '🔄',
    title: 'Always current',
    desc: 'Ratings refresh as you browse — new rows, search results, “More Like This.” Everything stays covered.',
  },
];

export const STATS = [
  { value: '2', label: 'rating sources on every card', sub: 'IMDb + Rotten Tomatoes' },
  { value: '0', label: 'accounts or sign-ups', sub: 'no login, ever' },
  { value: '<1s', label: 'to score a full screen', sub: 'fetched in parallel' },
  { value: '100%', label: 'free & open source', sub: 'audit it on GitHub' },
];

export const TESTIMONIALS = [
  {
    quote:
      'I used to keep IMDb open in a second tab the whole time I browsed Netflix. Now the score is just… there. I can’t go back.',
    name: 'Maya R.',
    role: 'Designer & serial binger',
    rating: '⭐ 9.2',
  },
  {
    quote:
      'The Rotten Tomatoes number next to IMDb is the killer feature. Saves my movie nights from a lot of regret.',
    name: 'Devin O.',
    role: 'Film club organizer',
    rating: '🍅 94%',
  },
  {
    quote:
      'Installed it in under a minute and it just works. No account, no popups asking me to upgrade. Refreshing.',
    name: 'Priya S.',
    role: 'Software engineer',
    rating: '⭐ 8.8',
  },
  {
    quote:
      'It’s the first thing I install on a new laptop now. Browsing Netflix without ratings feels broken.',
    name: 'Tomás L.',
    role: 'Documentary nerd',
    rating: '🍅 88%',
  },
];

// Titles for the auto-scrolling marquee strip. Scores are illustrative.
export const MARQUEE = [
  { title: 'Breaking Bad', imdb: '9.5', rt: '96%' },
  { title: 'The Queen’s Gambit', imdb: '8.5', rt: '97%' },
  { title: 'Dark', imdb: '8.7', rt: '95%' },
  { title: 'Black Mirror', imdb: '8.7', rt: '83%' },
  { title: 'Money Heist', imdb: '8.2', rt: '90%' },
  { title: 'Arcane', imdb: '9.0', rt: '100%' },
  { title: 'The Witcher', imdb: '8.0', rt: '68%' },
  { title: 'Stranger Things', imdb: '8.7', rt: '86%' },
  { title: 'Wednesday', imdb: '8.1', rt: '67%' },
  { title: 'BoJack Horseman', imdb: '8.8', rt: '93%' },
  { title: 'Squid Game', imdb: '8.0', rt: '95%' },
  { title: 'Narcos', imdb: '8.8', rt: '89%' },
];

export const FAQS = [
  {
    q: 'What is Netflix Ratings?',
    a: 'Netflix Ratings is a free, open-source Chrome extension that shows the IMDb rating and the Rotten Tomatoes score in a small badge on each Netflix title card as you browse. You see both scores without opening another tab or searching anything. It runs on netflix.com in Chromium browsers such as Chrome, Edge and Brave.',
  },
  {
    q: 'Is Netflix Ratings free?',
    a: 'Yes. Netflix Ratings is completely free and open source. There is no paid tier, no subscription and no account to create. The full source code is on GitHub, so you can read exactly what the extension does before you install it.',
  },
  {
    q: 'Where do the ratings come from?',
    a: 'Ratings come from OMDb, the Open Movie Database. The extension looks up each Netflix title by name through the OMDb API and reads the IMDb rating and Rotten Tomatoes score OMDb returns. The scores are not calculated or edited by Netflix Ratings, so they match what OMDb has on file for that title.',
  },
  {
    q: 'How is the Rotten Tomatoes score defined?',
    a: 'The Tomatometer is the percentage of professional critic reviews that are positive, according to Rotten Tomatoes. It is a head-count, not an average of how good the reviews were. A title is labelled Fresh when at least 60% of reviews are positive and Rotten below that. The IMDb number is a separate 1 to 10 audience rating.',
  },
  {
    q: 'Does it show ratings for every title?',
    a: 'No. If OMDb has no match for a title, or has an IMDb rating but no Rotten Tomatoes score, the badge shows only the score it found, or nothing. This is most common with very new releases, some Netflix originals and titles whose Netflix name differs from the database listing.',
  },
  {
    q: 'Does it work on the Netflix mobile app or TV?',
    a: 'No. Netflix Ratings is a browser extension, and its manifest only covers www.netflix.com, so it works when you browse Netflix on a computer in Chrome, Edge, Brave or another Chromium browser. Browser extensions do not run inside the Netflix app on phones, tablets, smart TVs or game consoles, so no badges appear there.',
  },
  {
    q: 'Does it slow Netflix down?',
    a: 'It is designed not to. The extension only adds a small text badge to title cards, waits 300 milliseconds after the page changes before scanning, fetches ratings in a background worker in parallel, and caches repeat lookups in memory. It does not touch video playback. We have not published benchmark numbers.',
  },
  {
    q: 'Is Netflix Ratings affiliated with Netflix?',
    a: 'No. Netflix Ratings is an independent project by Igor Gazivoda and is not affiliated with, endorsed by or sponsored by Netflix, IMDb or Rotten Tomatoes. Netflix, IMDb and Rotten Tomatoes are trademarks of their respective owners. The extension only reads the title cards that your own browser already displays.',
  },
  {
    q: 'Does the extension collect my data?',
    a: 'No. The extension needs no account or login and does not track your viewing history. The only data it sends is the movie or show title, to OMDb, so it can look up the scores. Its permissions are limited to netflix.com and omdbapi.com. Nothing about you is stored or shared by the extension.',
  },
  {
    q: 'How do I install Netflix Ratings?',
    a: 'It is not on the Chrome Web Store yet, so you install it from GitHub. Download the repository, open chrome://extensions, turn on Developer mode, click Load unpacked and choose the extension folder. Then open netflix.com and the badges appear on title cards. The whole process takes about a minute.',
  },
];
