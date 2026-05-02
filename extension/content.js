(function () {
  'use strict';

  const IMDB_API = 'https://api.imdbapi.dev';
  const RATED_ATTR = 'data-imdb-rated';
  let debounceTimer = null;

  function getUnratedAnchors() {
    return Array.from(
      document.querySelectorAll(`.title-card a[aria-label]:not([${RATED_ATTR}])`)
    );
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

  async function fetchRating(title) {
    try {
      const res = await fetch(
        `${IMDB_API}/search/titles?query=${encodeURIComponent(title)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.titles?.[0]?.rating?.aggregateRating ?? null;
    } catch {
      return null;
    }
  }

  async function scanAndRate() {
    const anchors = getUnratedAnchors();
    if (!anchors.length) return;

    const entries = anchors
      .map((anchor) => ({
        title: anchor.getAttribute('aria-label'),
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
