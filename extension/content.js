(function () {
  'use strict';

  const RATED_ATTR = 'data-imdb-rated';
  let debounceTimer = null;
  let isScanning = false;

  let port = null;
  const pending = new Map();
  let nextId = 0;

  function getPort() {
    if (port) return port;
    port = chrome.runtime.connect({ name: 'ratings' });
    port.onMessage.addListener(({ id, rating }) => {
      const resolve = pending.get(id);
      if (resolve) {
        pending.delete(id);
        resolve(rating);
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      pending.forEach((resolve) => resolve(null));
      pending.clear();
    });
    return port;
  }

  function fetchRating(title) {
    return new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      try {
        getPort().postMessage({ type: 'FETCH_RATING', title, id });
      } catch {
        pending.delete(id);
        resolve(null);
      }
    });
  }

  function extractTitle(ariaLabel) {
    return ariaLabel
      .replace(/,\s*(Season|Part|Volume|Episode)\s+\d+.*/i, '')
      .replace(/:\s*(More Info|Play|Resume|Watch)$/i, '')
      .trim();
  }

  function getUnratedAnchors() {
    return Array.from(
      document.querySelectorAll(`a[aria-label]:not([${RATED_ATTR}])`)
    ).filter((a) => {
      if (!a.querySelector('img')) return false;
      const href = a.getAttribute('href') || '';
      return href.includes('/watch/') || href.includes('/title/');
    });
  }

  function prepareAnchor(anchor) {
    anchor.setAttribute(RATED_ATTR, 'true');
    anchor.setAttribute('data-imdb-rating', '⭐ …');
    return anchor;
  }

  async function scanAndRate() {
    if (isScanning) return;
    isScanning = true;
    try {
      const anchors = getUnratedAnchors();
      if (!anchors.length) return;

      const entries = anchors.map((anchor) => ({
        title: extractTitle(anchor.getAttribute('aria-label')),
        el: prepareAnchor(anchor),
      }));

      await Promise.allSettled(
        entries.map(async ({ title, el }) => {
          const rating = await fetchRating(title);
          if (rating !== null) {
            el.setAttribute('data-imdb-rating', `⭐ ${rating}`);
          } else {
            el.removeAttribute('data-imdb-rating');
          }
        })
      );
    } finally {
      isScanning = false;
    }
  }

  function debouncedScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanAndRate, 300);
  }

  scanAndRate();

  new MutationObserver(debouncedScan).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
