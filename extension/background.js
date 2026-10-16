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

// Loose comparison key: case, accents, punctuation, "&" vs "and" and a leading "The" are ignored.
function normalizeTitle(t) {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

const isRateLimited = (data) => /limit/i.test(data?.Error || '');

// Best exact-title (normalised) match from an OMDb ?s= search, newest first.
function pickExact(searchData, title) {
  if (searchData?.Response !== 'True' || !searchData.Search?.length) return null;
  const wanted = normalizeTitle(title);
  return (
    searchData.Search.filter((r) => normalizeTitle(r.Title) === wanted).sort(
      (a, b) => (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0)
    )[0] || null
  );
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

    // Quota exhausted: answer "no rating" for now but do not cache it, so the title is retried later.
    if (isRateLimited(data)) return { rating: null, rtRating: null };

    // Not found by exact name (typographic apostrophes, "&" vs "and", ...): try one search
    // and accept only a title that matches after normalisation.
    if (data?.Response !== 'True') {
      const sRes = await fetch(
        `https://www.omdbapi.com/?s=${encodeURIComponent(title.replace(/[\u2018\u2019]/g, "'"))}&apikey=${OMDB_API_KEY}`
      );
      const sData = sRes.ok ? await sRes.json() : null;
      if (isRateLimited(sData)) return { rating: null, rtRating: null };
      const hit = pickExact(sData, title);
      let found = { rating: null, rtRating: null };
      if (hit) {
        const iRes = await fetch(`https://www.omdbapi.com/?i=${hit.imdbID}&apikey=${OMDB_API_KEY}`);
        const iData = iRes.ok ? await iRes.json() : null;
        if (iData?.Response === 'True') found = parseRatings(iData);
      }
      cache.set(title, found);
      return found;
    }

    // Found with RT data → return immediately (1 call total).
    if (rtRating !== null) {
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
      const best = pickExact(searchData, title);
      const directImdbId = data?.imdbID;

      if (best && best.imdbID !== directImdbId) {
        const betterRes = await fetch(
          `https://www.omdbapi.com/?i=${best.imdbID}&apikey=${OMDB_API_KEY}`
        );
        const betterData = betterRes.ok ? await betterRes.json() : null;
        if (betterData?.Response === 'True') {
          // Only switch entries when the newer one actually has a Rotten Tomatoes score;
          // otherwise keep the first match's IMDb rating instead of replacing it with "N/A".
          const better = parseRatings(betterData);
          if (better.rtRating !== null) result = better;
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
