#!/usr/bin/env node
// Notify IndexNow (Bing, and therefore Copilot/ChatGPT's Bing-backed index) that
// our pages changed, for near-instant recrawl. Run after each production deploy.
// The URL list is derived from the sitemap, so new pages are picked up automatically.
//
//   npm run seo:indexnow                 # fetch ${SITE_URL}/sitemap.xml (live) and submit
//   npm run seo:indexnow:dry             # no network: read the local build, print the payload
//   node scripts/ping-indexnow.mjs --local [file] [--dry-run]
//
// Flags:
//   --local [file]  read the sitemap from disk instead of the live site; the file
//                   defaults to .next/server/app/sitemap.xml.body (needs `next build`)
//   --dry-run       print what would be sent and exit; never POSTs to IndexNow
//                   (without --local the live sitemap is still fetched, read-only)
//
// Site origin comes from NEXT_PUBLIC_SITE_URL (default https://rating.watch).
// The key below must match the verification file served at
//   <host>/682b64e6a0f625f3b476439b6c6f1d81.txt
// (lives in /public, so Next serves it at the site root).

import { readFile } from 'node:fs/promises';
import { sitemapUrls } from './lib/sitemap-urls.mjs';

const KEY = '682b64e6a0f625f3b476439b6c6f1d81';
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rating.watch').replace(/\/$/, '');
const DEFAULT_LOCAL_SITEMAP = '.next/server/app/sitemap.xml.body';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH = 10000; // IndexNow's per-request URL limit

function parseArgs(argv) {
  const opts = { dryRun: false, local: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--local') {
      const next = argv[i + 1];
      opts.local = next && !next.startsWith('--') ? (i++, next) : DEFAULT_LOCAL_SITEMAP;
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

async function loadSitemap(local) {
  if (local) return { xml: await readFile(local, 'utf8'), source: local };
  const source = `${SITE_URL}/sitemap.xml`;
  const res = await fetch(source);
  if (!res.ok) throw new Error(`GET ${source} failed (HTTP ${res.status})`);
  return { xml: await res.text(), source };
}

async function main() {
  const { dryRun, local } = parseArgs(process.argv.slice(2));
  const host = new URL(SITE_URL).host;

  let sitemap;
  try {
    sitemap = await loadSitemap(local);
  } catch (err) {
    const hint = local && err.code === 'ENOENT' ? ' (run `npm run build` first)' : '';
    console.error(`IndexNow: could not read sitemap: ${err.message}${hint}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = sitemapUrls(sitemap.xml, { host });
  } catch (err) {
    console.error(`IndexNow: ${sitemap.source}: ${err.message}`);
    process.exit(1);
  }
  const { urls: urlList, skipped } = parsed;
  if (skipped.length) {
    console.warn(`IndexNow: skipping ${skipped.length} URL(s) not on ${host}:\n  ${skipped.join('\n  ')}`);
  }
  if (urlList.length === 0) {
    console.error(`IndexNow: no ${host} URLs in ${sitemap.source}; check NEXT_PUBLIC_SITE_URL`);
    process.exit(1);
  }

  const payloads = [];
  for (let i = 0; i < urlList.length; i += BATCH) {
    payloads.push({ host, key: KEY, keyLocation: `${SITE_URL}/${KEY}.txt`, urlList: urlList.slice(i, i + BATCH) });
  }

  if (dryRun) {
    console.log(`IndexNow (dry run): ${urlList.length} URLs from ${sitemap.source}; nothing sent`);
    console.log(`POST ${ENDPOINT}`);
    console.log(JSON.stringify(payloads.length === 1 ? payloads[0] : payloads, null, 2));
    return;
  }

  for (const payload of payloads) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    // IndexNow returns 200 or 202 on success; 422 means the key/host didn't validate.
    if (res.ok) {
      console.log(`IndexNow: submitted ${payload.urlList.length} URLs for ${host} (HTTP ${res.status})`);
    } else {
      console.error(`IndexNow: submission failed (HTTP ${res.status})`);
      console.error(await res.text());
      process.exit(1);
    }
  }
}

await main();
