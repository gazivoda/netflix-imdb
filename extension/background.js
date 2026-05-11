'use strict';

const OMDB_API_KEY = '901841e0';
const cache = new Map();

async function getRatings(title) {
  if (cache.has(title)) return cache.get(title);
  try {
    const res = await fetch(
      `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`
    );
    const data = res.ok ? await res.json() : null;

    const rating =
      data?.imdbRating && data.imdbRating !== 'N/A'
        ? parseFloat(data.imdbRating)
        : null;

    const rtEntry = data?.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
    const rtParsed = rtEntry ? parseInt(rtEntry.Value.replace('%', ''), 10) : null;
    const rtRating = rtParsed !== null && !Number.isNaN(rtParsed) ? rtParsed : null;

    const result = { rating, rtRating };
    cache.set(title, result);
    return result;
  } catch {
    return { rating: null, rtRating: null };
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ratings') return;

  port.onMessage.addListener(({ type, title, id }) => {
    if (type !== 'FETCH_RATING') return;
    getRatings(title).then(({ rating, rtRating }) => {
      try {
        port.postMessage({ id, rating, rtRating });
      } catch {
        // port disconnected before response — discard
      }
    });
  });
});
