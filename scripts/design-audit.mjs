#!/usr/bin/env node
// Design audit against a RUNNING server. Builds nothing.
//
//   node scripts/design-audit.mjs http://localhost:3419
//   node scripts/design-audit.mjs --url http://localhost:3419 [--strict] [--json]
//
// For every page in the registry (lib/pages.ts) it fetches the HTML and each linked
// stylesheet (<link rel="stylesheet"> plus inline <style>), then reports:
//   1. CLASSES WITHOUT CSS: class names used in the page's HTML that no stylesheet on
//      that page defines as a `.class` selector. Usually a typo, a class missing from a
//      CSS Module (renders as the literal class "undefined"), or a leftover from a refactor.
//   2. OFF-TOKEN COLOURS: hex colours in the linked CSS that are not part of the design
//      token set (the hex values declared in app/globals.css :root, resolved from disk).
//      #fff / #ffffff is tolerated by default (white text on signal/teal/ink is allowed);
//      pass --strict to flag it too. White BACKGROUNDS are caught by tests/design-guards.
// Exit code: 0 clean, 1 findings, 2 cannot reach the server / bad usage.
// (Node >= 22.18 strips TypeScript types natively, hence the .ts import, as in check-links.mjs.)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning');
const { PAGES } = await import('../lib/pages.ts');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const urlFlag = args.indexOf('--url');
const baseUrl = (urlFlag !== -1 ? args[urlFlag + 1] : args.find((a) => !a.startsWith('--')))?.replace(/\/$/, '');
if (!baseUrl) {
  console.error('Usage: node scripts/design-audit.mjs <base-url> [--strict] [--json]\n  e.g. node scripts/design-audit.mjs http://localhost:3419');
  process.exit(2);
}
const strict = flag('--strict');

// ── Token set ────────────────────────────────────────────────────────────────

function normHex(h) {
  h = h.toLowerCase().replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  return '#' + h.slice(0, 6); // ignore alpha channel: the colour itself must be a token
}

const globalsCss = readFileSync(join(root, 'app', 'globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(globalsCss)?.[1] ?? '';
const TOKEN_HEX = new Set([...rootBlock.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => normHex(m[0])));
if (TOKEN_HEX.size < 6) {
  console.error('Could not read the token set from app/globals.css :root');
  process.exit(2);
}
if (!strict) {
  TOKEN_HEX.add('#ffffff'); // white text is allowed on signal/teal/ink
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

const cache = new Map();
async function get(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url, { redirect: 'follow' }).then(async (r) => {
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.text();
  });
  cache.set(url, p);
  return p;
}

// ── Extraction ───────────────────────────────────────────────────────────────

const stripCssNoise = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/url\([^)]*\)/gi, 'url()')
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');

/** Class names that appear as `.name` selectors (CSS escapes undone). */
function definedClasses(css) {
  const out = new Set();
  // First char must not be a digit (that would be a decimal like `.5s`).
  for (const m of stripCssNoise(css).matchAll(/\.((?:\\.|[A-Za-z_-])(?:\\.|[\w-])*)/g)) {
    out.add(m[1].replace(/\\(.)/g, '$1'));
  }
  return out;
}

function usedClasses(html) {
  const out = new Set();
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  for (const m of body.matchAll(/\sclass="([^"]*)"/gi)) for (const c of m[1].split(/\s+/)) if (c) out.add(c);
  return out;
}

function stylesheetUrls(html) {
  const urls = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel="stylesheet"/i.test(m[0])) continue;
    const href = /href="([^"]+)"/i.exec(m[0])?.[1];
    if (href) urls.push(new URL(href.replace(/&amp;/g, '&'), baseUrl + '/').toString());
  }
  return urls;
}

const inlineStyles = (html) => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);

// ── Run ──────────────────────────────────────────────────────────────────────

const classFindings = []; // { path, classes: [] }
const colourFindings = new Map(); // css url -> Map(hex -> {count, lines[]})
const failures = [];

for (const page of PAGES) {
  let html;
  try {
    html = await get(baseUrl + page.path);
  } catch (e) {
    failures.push(`${page.path}: ${e.message}`);
    continue;
  }
  const sheets = stylesheetUrls(html);
  const cssTexts = [...inlineStyles(html)];
  for (const url of sheets) {
    try {
      const css = await get(url);
      cssTexts.push(css);
      if (!colourFindings.has(url)) {
        const found = new Map();
        const clean = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
        // Built CSS is minified onto one line, so report a snippet of context instead of a line number.
        for (const m of clean.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
          if (![3, 4, 6, 8].includes(m[0].length - 1)) continue; // not a colour (e.g. an id selector)
          const hex = normHex(m[0]);
          if (TOKEN_HEX.has(hex)) continue;
          const e = found.get(hex) ?? { count: 0, contexts: [] };
          e.count++;
          if (e.contexts.length < 2) e.contexts.push(clean.slice(Math.max(0, m.index - 40), m.index + m[0].length).replace(/\s+/g, ' ').trim());
          found.set(hex, e);
        }
        colourFindings.set(url, found);
      }
    } catch (e) {
      failures.push(`${page.path}: stylesheet ${e.message}`);
    }
  }
  const defined = new Set();
  for (const css of cssTexts) for (const c of definedClasses(css)) defined.add(c);
  const missing = [...usedClasses(html)].filter((c) => !defined.has(c)).sort();
  if (missing.length) classFindings.push({ path: page.path, classes: missing });
}

if (failures.length === PAGES.length) {
  console.error(`Could not fetch any page from ${baseUrl}. Is the server running?\n  ${failures[0]}`);
  process.exit(2);
}

// ── Report ───────────────────────────────────────────────────────────────────

const colourRows = [...colourFindings].filter(([, m]) => m.size);
if (flag('--json')) {
  console.log(
    JSON.stringify(
      {
        baseUrl,
        tokenHex: [...TOKEN_HEX],
        classesWithoutCss: classFindings,
        offTokenColours: colourRows.map(([url, m]) => ({ css: url, colours: Object.fromEntries(m) })),
        fetchFailures: failures,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`Design audit: ${PAGES.length} registry pages, ${cache.size} fetches, base ${baseUrl}`);
  console.log(`Token colours (${TOKEN_HEX.size}): ${[...TOKEN_HEX].join(' ')}${strict ? '' : '  (+ #ffffff tolerated; --strict to flag)'}\n`);

  console.log(`1. Classes used in HTML with no CSS definition: ${classFindings.length} page(s)`);
  for (const f of classFindings) console.log(`   ${f.path}\n     ${f.classes.join('  ')}`);

  const totalColours = colourRows.reduce((n, [, m]) => n + [...m.values()].reduce((a, b) => a + b.count, 0), 0);
  console.log(`\n2. Hex colours outside the token set: ${totalColours} occurrence(s) in ${colourRows.length} stylesheet(s)`);
  for (const [url, m] of colourRows) {
    console.log(`   ${url.replace(baseUrl, '')}`);
    for (const [hex, e] of [...m].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`     ${hex}  x${e.count}   e.g. ...${e.contexts.join('  |  ...')}`);
    }
  }
  if (failures.length) console.log(`\nFetch failures (${failures.length}):\n   ${failures.join('\n   ')}`);
  console.log(classFindings.length || colourRows.length ? '\nFAIL' : '\nOK');
}
process.exit(classFindings.length || colourRows.length || failures.length ? 1 : 0);
