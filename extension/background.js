'use strict';

const cache = new Map();
const queue = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const { title, resolve } = queue.shift();

    if (cache.has(title)) {
      resolve(cache.get(title));
      continue;
    }

    try {
      const res = await fetch(
        `https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(title)}`
      );
      const rating = res.ok
        ? ((await res.json()).titles?.[0]?.rating?.aggregateRating ?? null)
        : null;
      cache.set(title, rating);
      resolve(rating);
    } catch {
      resolve(null);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  processing = false;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'FETCH_RATING') return false;

  new Promise((resolve) => {
    queue.push({ title: message.title, resolve });
    processQueue();
  }).then((rating) => sendResponse({ rating }));

  return true; // keep channel open for async response
});
