#!/usr/bin/env node
// Notify IndexNow (Bing, and therefore Copilot/ChatGPT's Bing-backed index) that
// our pages changed, for near-instant recrawl. Run after each production deploy:
//
//   NEXT_PUBLIC_SITE_URL=https://netflix-ratings.app node scripts/ping-indexnow.mjs
//
// The key below must match the verification file served at
//   <host>/682b64e6a0f625f3b476439b6c6f1d81.txt
// (lives in /public, so Next serves it at the site root).

const KEY = '682b64e6a0f625f3b476439b6c6f1d81';
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://netflix-ratings.app').replace(/\/$/, '');

// Keep in sync with app/sitemap.ts.
const PATHS = ['/', '/compare/imdb-vs-rotten-tomatoes', '/camera-vision', '/privacy'];
const urlList = PATHS.map((p) => `${SITE_URL}${p}`);

const host = new URL(SITE_URL).host;
const payload = {
  host,
  key: KEY,
  keyLocation: `${SITE_URL}/${KEY}.txt`,
  urlList,
};

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

// IndexNow returns 200 or 202 on success; 422 means the key/host didn't validate.
if (res.ok) {
  console.log(`IndexNow: submitted ${urlList.length} URLs for ${host} (HTTP ${res.status})`);
} else {
  console.error(`IndexNow: submission failed (HTTP ${res.status})`);
  console.error(await res.text());
  process.exit(1);
}
