'use strict';

// Shared fallback key. The free OMDb tier allows 1,000 requests/day per key, so every user of
// this key shares that budget. Users can paste their own free key on the options page.
const BUNDLED_OMDB_KEY = '901841e0';

const DAY = 24 * 60 * 60 * 1000;
const TTL_FOUND = 7 * DAY; // a title with at least one score
const TTL_MISSING = DAY; // OMDb had nothing yet; try again tomorrow
const LIMIT_PAUSE = 30 * 60 * 1000; // after "Request limit reached", stop calling OMDb for a while

const memory = new Map(); // title -> { rating, rtRating }
const inflight = new Map(); // title -> Promise, so a card and its hover pop-up share one lookup
let limitedUntil = 0;
let keyCache; // undefined = not loaded yet

// ---- persistence (IndexedDB, extension-private; needs no extra permission) ----------------

let dbPromise;
function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('ratings-cache', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('ratings', { keyPath: 'title' });
      req.result.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idb(storeName, mode, run) {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const tx = d.transaction(storeName, mode);
      const req = run(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = tx.onabort = () => resolve(undefined);
    });
  } catch {
    return undefined; // private mode / storage blocked: fall back to memory only
  }
}

const readStored = (title) => idb('ratings', 'readonly', (s) => s.get(title));
const writeStored = (title, { rating, rtRating }) =>
  idb('ratings', 'readwrite', (s) => s.put({ title, rating, rtRating, ts: Date.now() }));

async function getKey() {
  if (keyCache === undefined) {
    const row = await idb('meta', 'readonly', (s) => s.get('omdbKey'));
    keyCache = row?.value || '';
  }
  return keyCache || BUNDLED_OMDB_KEY;
}

// ---- OMDb ----------------------------------------------------------------------------------

class LimitError extends Error {}

async function omdb(params) {
  const key = await getKey();
  const res = await fetch(`https://www.omdbapi.com/?${params}&apikey=${encodeURIComponent(key)}`);
  const data = res.ok ? await res.json() : null;
  if (/limit/i.test(data?.Error || '')) throw new LimitError();
  return data;
}

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
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

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

async function lookup(title) {
  // Step 1: direct lookup — 1 API call for the common case.
  const data = await omdb(`t=${encodeURIComponent(title)}`);
  const { rating, rtRating } = parseRatings(data);

  // Not found by exact name (typographic apostrophes, "&" vs "and", ...): try one search
  // and accept only a title that matches after normalisation.
  if (data?.Response !== 'True') {
    const sData = await omdb(`s=${encodeURIComponent(title.replace(/[‘’]/g, "'"))}`);
    const hit = pickExact(sData, title);
    if (!hit) return { rating: null, rtRating: null };
    const iData = await omdb(`i=${hit.imdbID}`);
    return iData?.Response === 'True' ? parseRatings(iData) : { rating: null, rtRating: null };
  }

  // Found with RT data → done (1 call total).
  if (rtRating !== null) return { rating, rtRating };

  // Found but no RT score: ?t= may have picked the wrong entry when multiple titles share the
  // same name. Search for a newer exact-title match that does have RT data.
  let result = { rating, rtRating };
  const searchData = await omdb(`s=${encodeURIComponent(title)}`);
  const best = pickExact(searchData, title);
  if (best && best.imdbID !== data?.imdbID) {
    const betterData = await omdb(`i=${best.imdbID}`);
    if (betterData?.Response === 'True') {
      // Only switch entries when the newer one actually has a Rotten Tomatoes score;
      // otherwise keep the first match's IMDb rating instead of replacing it with "N/A".
      const better = parseRatings(betterData);
      if (better.rtRating !== null) result = better;
    }
  }
  return result;
}

// ---- quota notice on the toolbar icon --------------------------------------------------------

function showLimited(on) {
  try {
    chrome.action.setBadgeText({ text: on ? '!' : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#e5241b' });
    chrome.action.setTitle({
      title: on
        ? 'Daily OMDb limit reached. Click to add your own free API key.'
        : 'Ratings for Netflix',
    });
  } catch {
    // action API unavailable: ignore
  }
}

// ---- public entry point ----------------------------------------------------------------------

const EMPTY = { rating: null, rtRating: null };
const LIMITED = { rating: null, rtRating: null, limited: true };

async function getRatings(title) {
  if (memory.has(title)) return memory.get(title);

  const stored = await readStored(title);
  if (stored) {
    const hasScore = stored.rating !== null || stored.rtRating !== null;
    if (Date.now() - stored.ts < (hasScore ? TTL_FOUND : TTL_MISSING)) {
      const result = { rating: stored.rating, rtRating: stored.rtRating };
      memory.set(title, result);
      return result;
    }
  }

  if (Date.now() < limitedUntil) return LIMITED;

  try {
    const result = await lookup(title);
    memory.set(title, result);
    writeStored(title, result);
    if (limitedUntil) clearLimit();
    return result;
  } catch (err) {
    if (err instanceof LimitError) {
      // Do not cache: the title is retried once the quota (or key) is back.
      limitedUntil = Date.now() + LIMIT_PAUSE;
      showLimited(true);
      return LIMITED;
    }
    return EMPTY;
  }
}

// Quota is back (pause expired and a lookup worked, or the user saved a key): tell every open
// Netflix tab to re-check the cards it skipped.
const ports = new Set();
function clearLimit() {
  limitedUntil = 0;
  showLimited(false);
  ports.forEach((p) => {
    try {
      p.postMessage({ type: 'RETRY' });
    } catch {
      ports.delete(p);
    }
  });
}

function getRatingsOnce(title) {
  if (!inflight.has(title)) {
    inflight.set(title, getRatings(title).finally(() => inflight.delete(title)));
  }
  return inflight.get(title);
}

// ---- messaging --------------------------------------------------------------------------------

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ratings') return;
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));

  port.onMessage.addListener(({ type, title, id }) => {
    if (type !== 'FETCH_RATING') return;
    getRatingsOnce(title).then(({ rating, rtRating, limited }) => {
      try {
        port.postMessage({ id, rating, rtRating, limited: Boolean(limited) });
      } catch {
        // port disconnected before response — discard
      }
    });
  });
});

// Options page: read / validate / save / clear the user's own OMDb key.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (msg?.type === 'GET_KEY') {
    getKey().then(() => sendResponse({ custom: Boolean(keyCache) }));
    return true;
  }
  if (msg?.type === 'SET_KEY') {
    (async () => {
      const key = String(msg.key || '').trim();
      if (key) {
        if (!/^[A-Za-z0-9]{4,16}$/.test(key)) return sendResponse({ ok: false, error: 'That does not look like an OMDb key.' });
        try {
          const res = await fetch(`https://www.omdbapi.com/?t=Inception&apikey=${encodeURIComponent(key)}`);
          const data = await res.json();
          if (data?.Response !== 'True') {
            return sendResponse({ ok: false, error: data?.Error || 'OMDb rejected that key.' });
          }
        } catch {
          return sendResponse({ ok: false, error: 'Could not reach OMDb. Check your connection.' });
        }
      }
      await idb('meta', 'readwrite', (s) => (key ? s.put({ key: 'omdbKey', value: key }) : s.delete('omdbKey')));
      keyCache = key;
      clearLimit();
      sendResponse({ ok: true, custom: Boolean(key) });
    })();
    return true;
  }
});

// No popup: clicking the toolbar icon opens the settings (where the OMDb key can be added).
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
