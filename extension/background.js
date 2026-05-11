'use strict';

const OMDB_API_KEY = '901841e0';
const cache = new Map();

function parseRatings(data) {
  const rating =
    data?.imdbRating && data.imdbRating !== 'N/A'
      ? parseFloat(data.imdbRating)
      : null;
  const rtEntry = data?.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
  const rtParsed = rtEntry ? parseInt(rtEntry.Value.replace('%', ''), 10) : null;
  const rtRating = rtParsed !== null && !Number.isNaN(rtParsed) ? rtParsed : null;
  return { rating, rtRating };
}

async function getRatings(title) {
  if (cache.has(title)) return cache.get(title);
  try {
    // Step 1: direct lookup — 1 API call for the common case.
    const res = await fetch(
      `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`
    );
    const data = res.ok ? await res.json() : null;
    const { rating, rtRating } = parseRatings(data);

    // Found with RT data, or not found at all → return immediately (1 call total).
    if (data?.Response !== 'True' || rtRating !== null) {
      const result = { rating, rtRating };
      cache.set(title, result);
      return result;
    }

    // Found but no RT score: ?t= may have picked the wrong entry when multiple
    // titles share the same name. Search for a newer exact-title match with RT data.
    const searchRes = await fetch(
      `https://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`
    );
    const searchData = searchRes.ok ? await searchRes.json() : null;

    let result = { rating, rtRating };

    if (searchData?.Response === 'True' && searchData.Search?.length) {
      const normalized = title.toLowerCase().trim();
      const exact = searchData.Search
        .filter(r => r.Title.toLowerCase().trim() === normalized)
        .sort((a, b) => (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0));

      const best = exact[0];
      const directImdbId = data?.imdbID;

      if (best && best.imdbID !== directImdbId) {
        const betterRes = await fetch(
          `https://www.omdbapi.com/?i=${best.imdbID}&apikey=${OMDB_API_KEY}`
        );
        const betterData = betterRes.ok ? await betterRes.json() : null;
        if (betterData?.Response === 'True') {
          result = parseRatings(betterData);
        }
      }
    }

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
