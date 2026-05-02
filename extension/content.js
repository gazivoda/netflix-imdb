(function () {
  'use strict';

  const RATED_ATTR = 'data-imdb-rated';
  let debounceTimer = null;
  let isScanning = false;

  function extractTitle(ariaLabel) {
    return ariaLabel
      .replace(/,\s*(Season|Part|Volume|Episode)\s+\d+.*/i, '')
      .replace(/:\s*(More Info|Play|Resume|Watch)$/i, '')
      .trim();
  }

  function getUnratedAnchors() {
    return Array.from(
      document.querySelectorAll(`a[aria-label]:not([${RATED_ATTR}])`)
    ).filter((a) => a.querySelector('.boxart-container'));
  }

  function injectPlaceholder(anchor) {
    anchor.setAttribute(RATED_ATTR, 'true');
    const boxart = anchor.querySelector('.boxart-container');
    if (!boxart) return null;
    const badge = document.createElement('div');
    badge.className = 'imdb-badge';
    badge.textContent = '⭐ …';
    boxart.style.position = 'relative';
    boxart.appendChild(badge);
    return badge;
  }

  function fetchRating(title) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'FETCH_RATING', title }, (response) => {
        resolve(response?.rating ?? null);
      });
    });
  }

  async function scanAndRate() {
    if (isScanning) return;
    isScanning = true;
    try {
      const anchors = getUnratedAnchors();
      if (!anchors.length) return;

      const entries = anchors
        .map((anchor) => ({
          title: extractTitle(anchor.getAttribute('aria-label')),
          badge: injectPlaceholder(anchor),
        }))
        .filter((e) => e.badge !== null);

      await Promise.allSettled(
        entries.map(async ({ title, badge }) => {
          const rating = await fetchRating(title);
          if (rating !== null) {
            badge.textContent = `⭐ ${rating}`;
          } else {
            badge.remove();
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
