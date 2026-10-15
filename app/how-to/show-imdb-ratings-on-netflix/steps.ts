// Kept outside page.tsx (Next only allows specific exports from a page file)
// so the HowTo steps can be unit-tested.
export const STEPS = [
  {
    name: 'Install the Netflix Ratings extension',
    text: 'Download Netflix Ratings from GitHub and load it as an unpacked extension in Chrome, Edge or Brave. The install takes about a minute and needs no account or API key.',
  },
  {
    name: 'Open Netflix in your browser',
    text: 'Go to www.netflix.com and sign in as usual. If Netflix was already open when you installed the extension, reload the tab once.',
  },
  {
    name: 'Look at the top-right corner of each title card',
    text: 'Every title card gets a small dark badge in its top-right corner. The number next to the star is the IMDb rating out of 10; a tomato with a percentage is the Rotten Tomatoes score.',
  },
  {
    name: 'Keep browsing',
    text: 'Rows you scroll into, search results and More Like This suggestions are rated automatically as they load, so there is nothing to click and no tab to switch to.',
  },
];
