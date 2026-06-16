// Shared homepage content. Kept in one place so on-page copy and the
// JSON-LD structured data (FAQPage, SoftwareApplication) never drift apart.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://netflix-ratings.app';

export const REPO_URL = 'https://github.com/gazivoda/netflix-imdb';

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
    a: 'Netflix Ratings is a free, open-source Chrome extension that overlays IMDb and Rotten Tomatoes scores directly onto Netflix title cards as you browse. You see the rating without opening another tab or searching anything.',
  },
  {
    q: 'Is Netflix Ratings free?',
    a: 'Yes. Netflix Ratings is completely free and open source. There is no paid tier, no subscription, and no account required. You can read and audit the full source code on GitHub.',
  },
  {
    q: 'Does the extension collect my data?',
    a: 'No. The extension does not require an account or login and does not track your viewing history. It only sends movie and show titles to the ratings data source to fetch scores — nothing about you is stored or shared.',
  },
  {
    q: 'Which ratings does it show?',
    a: 'Each Netflix title card displays two scores side by side: the IMDb user rating (out of 10) and the Rotten Tomatoes critic score (as a percentage). You get both the audience and critic perspective at a glance.',
  },
  {
    q: 'How do I install Netflix Ratings?',
    a: 'Download the repository from GitHub, open chrome://extensions, enable Developer mode, click “Load unpacked,” and select the extension folder. Then open netflix.com and ratings appear automatically. The whole process takes under a minute.',
  },
  {
    q: 'Does it work on all Netflix plans?',
    a: 'Yes. Netflix Ratings works on every Netflix plan and region because it reads the title cards already shown in your browser. It does not depend on your subscription tier.',
  },
];
