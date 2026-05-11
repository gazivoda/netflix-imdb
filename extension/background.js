'use strict';

const OMDB_API_KEY = '901841e0';
const cache = new Map();

async function getRatings(title) {
  if (cache.has(title)) return cache.get(title);
  try {
    // Step 1: search to resolve ambiguous titles (e.g. two films named "Cover-Up").
    // Pick the exact-title match with the most recent year; fall back to ?t= if search fails.
    let candidateId = null;
    try {
      const searchRes = await fetch(
        `https://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`
      );
      const searchData = searchRes.ok ? await searchRes.json() : null;
      if (searchData?.Response === 'True' && searchData.Search?.length) {
        const normalized = title.toLowerCase().trim();
        const exact = searchData.Search
          .filter(r => r.Title.toLowerCase().trim() === normalized)
          .sort((a, b) => (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0));
        candidateId = (exact[0] ?? searchData.Search[0]).imdbID;
      }
    } catch { /* fall through to ?t= */ }

    // Step 2: fetch full details (by imdbID when resolved, else by title)
    const url = candidateId
      ? `https://www.omdbapi.com/?i=${candidateId}&apikey=${OMDB_API_KEY}`
      : `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`;

    const res = await fetch(url);
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
