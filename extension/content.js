(function () {
  'use strict';

  const RATED_ATTR = 'data-imdb-rated';
  const MODAL_ATTR = 'data-imdb-modal-title';
  let debounceTimer = null;
  let isScanning = false;

  let port = null;
  const pending = new Map();
  let nextId = 0;

  function getPort() {
    if (port) return port;
    port = chrome.runtime.connect({ name: 'ratings' });
    port.onMessage.addListener(({ type, id, rating, rtRating, limited }) => {
      if (type === 'RETRY') return retryDeferred();
      const resolve = pending.get(id);
      if (resolve) {
        pending.delete(id);
        resolve({ rating, rtRating, limited });
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      pending.forEach((resolve) => resolve({ rating: null, rtRating: null }));
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
        resolve({ rating: null, rtRating: null });
      }
    });
  }

  // OMDb's daily quota ran out: remember which cards were skipped (not "unrated") and re-check
  // them when the background worker says the quota is back, or every few minutes.
  const deferred = new Set();
  let retryTimer = null;

  function showNotice() {
    if (document.getElementById('nr-limit-notice')) return;
    const box = document.createElement('div');
    box.id = 'nr-limit-notice';
    const text = document.createElement('span');
    text.textContent = 'Ratings paused: shared OMDb daily limit reached.';
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Add your free key';
    open.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' }));
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '\u00d7';
    close.addEventListener('click', () => box.remove());
    box.append(text, open, close);
    document.body.appendChild(box);
  }

  function defer(el, isModal) {
    deferred.add({ el, isModal });
    showNotice();
    clearTimeout(retryTimer);
    retryTimer = setTimeout(retryDeferred, 5 * 60 * 1000);
  }

  function retryDeferred() {
    clearTimeout(retryTimer);
    document.getElementById('nr-limit-notice')?.remove();
    deferred.forEach(({ el, isModal }) => {
      el.removeAttribute(isModal ? MODAL_ATTR : RATED_ATTR);
    });
    deferred.clear();
    debouncedScan();
  }

  function formatRating(rating, rtRating) {
    const parts = [];
    if (rating !== null) parts.push(`⭐ ${rating}`);
    if (rtRating !== null) parts.push(`🍅 ${rtRating}%`);
    return parts.join('   ');
  }

  function extractTitle(ariaLabel) {
    return ariaLabel
      .replace(/,\s*(Season|Part|Volume|Episode)\s+\d+.*/i, '')
      .replace(/:\s*(More Info|Play|Resume|Watch)$/i, '')
      .replace(/\s*\([A-Z][A-Z.]{1,9}\)\s*$/, '')  // strip Netflix country codes: (U.S.), (UK), (U.K.)
      .trim();
  }

  function getUnratedAnchors() {
    return Array.from(
      document.querySelectorAll(`a[aria-label]:not([${RATED_ATTR}])`)
    ).filter((a) => {
      if (!a.querySelector('img')) return false;
      const href = a.getAttribute('href') || '';
      // Netflix now links cards as /browse?jbv=<id> (data-uia="standard-card" etc.);
      // older layouts used /watch/ and /title/.
      return (
        href.includes('/watch/') ||
        href.includes('/title/') ||
        href.includes('jbv=') ||
        /-card$/.test(a.getAttribute('data-uia') || '')
      );
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
          const { rating, rtRating, limited } = await fetchRating(title);
          if (limited) {
            el.removeAttribute('data-imdb-rating');
            return defer(el, false);
          }
          const label = formatRating(rating, rtRating);
          if (label) {
            el.setAttribute('data-imdb-rating', label);
          } else {
            el.removeAttribute('data-imdb-rating');
          }
        })
      );
    } finally {
      isScanning = false;
    }
  }

  // Netflix's hover pop-up (mini modal) and detail modal replace the card, so the card badge
  // disappears under them. Badge the modal's artwork as well; the title is the boxart alt text.
  async function rateModals() {
    const players = document.querySelectorAll('.previewModal--player_container');
    await Promise.allSettled(
      Array.from(players).map(async (el) => {
        const alt = el.querySelector('img.previewModal--boxart')?.getAttribute('alt');
        if (!alt) return;
        const title = extractTitle(alt);
        if (el.getAttribute(MODAL_ATTR) === title) return;
        el.setAttribute(MODAL_ATTR, title);
        const { rating, rtRating, limited } = await fetchRating(title);
        if (el.getAttribute(MODAL_ATTR) !== title) return; // modal now shows another title
        if (limited) return defer(el, true);
        const label = formatRating(rating, rtRating);
        if (label) el.setAttribute('data-imdb-rating', label);
        else el.removeAttribute('data-imdb-rating');
      })
    );
  }

  function debouncedScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      rateModals();
      scanAndRate();
    }, 300);
  }

  scanAndRate();
  rateModals();

  new MutationObserver(debouncedScan).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
