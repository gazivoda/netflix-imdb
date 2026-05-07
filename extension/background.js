'use strict';

const OMDB_API_KEY = '901841e0';
const cache = new Map();

async function getRating(title) {
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
    cache.set(title, rating);
    return rating;
  } catch {
    return null;
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ratings') return;

  port.onMessage.addListener(({ type, title, id }) => {
    if (type !== 'FETCH_RATING') return;
    getRating(title).then((rating) => {
      try {
        port.postMessage({ id, rating });
      } catch {
        // port disconnected before response — discard
      }
    });
  });
});
