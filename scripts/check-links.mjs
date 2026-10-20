#!/usr/bin/env node
// Internal-link + on-page SEO audit.
//   node scripts/check-links.mjs                  # reads the build in .next/server/app (run `next build` first)
//   node scripts/check-links.mjs --url http://localhost:3214   # fetches every registry page from a running server
// Exits 1 when any error-level finding exists. Analysis lives in lib/link-audit.ts.
// (Node >= 22.18 / 23.6 strips TypeScript types natively, hence the .ts imports.)

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node warns that the .ts files have no package "type"; harmless, so keep output clean.
process.removeAllListeners('warning');
const { analyzePages, formatTable } = await import('../lib/link-audit.ts');
const { PAGES } = await import('../lib/pages.ts');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rating.watch').replace(/\/$/, '');
const baseUrl = argValue('--url')?.replace(/\/$/, '');
const maxDepth = Number(argValue('--max-depth') ?? 2);
const registry = PAGES.map((p) => p.path);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Pages + valid non-page targets from the Next build output and /public. */
function loadBuild() {
  const appDir = join(root, '.next/server/app');
  if (!existsSync(appDir)) {
    console.error('No build found at .next/server/app. Run `npm run build` first, or pass --url.');
    process.exit(2);
  }
  const pages = [];
  const allow = new Set(['/sitemap.xml', '/robots.txt']);
  for (const file of walk(appDir)) {
    const rel = '/' + relative(appDir, file).split('\\').join('/');
    if (rel.endsWith('.html')) {
      if (rel.startsWith('/_')) continue; // _not-found
      const path = rel === '/index.html' ? '/' : rel.slice(0, -'.html'.length);
      pages.push({ path, html: readFileSync(file, 'utf8') });
    } else if (rel.endsWith('.body')) {
      allow.add(rel.slice(0, -'.body'.length)); // route handlers: /opengraph-image, /sitemap.xml...
    }
  }
  const pub = join(root, 'public');
  if (existsSync(pub)) for (const f of walk(pub)) allow.add('/' + relative(pub, f).split('\\').join('/'));
  return { pages, allow: [...allow, /^\/api\//, /^\/_next\//] };
}

async function loadLive() {
  const pages = [];
  for (const path of registry) {
    const res = await fetch(baseUrl + path, { redirect: 'manual' });
    if (res.status !== 200) {
      console.error(`GET ${baseUrl}${path} -> ${res.status}`);
      continue;
    }
    pages.push({ path, html: await res.text() });
  }
  return { pages, allow: [/^\/api\//, /^\/_next\//] };
}

const { pages, allow } = baseUrl ? await loadLive() : loadBuild();
let { findings, depth, inbound } = analyzePages(pages, { siteUrl, registry, allowTargets: allow, maxDepth });

// Live mode has no file listing, so confirm unknown link targets by requesting them.
if (baseUrl) {
  const probed = new Map();
  for (const f of findings.filter((x) => x.code === 'broken-link')) {
    if (!probed.has(f.target)) {
      const res = await fetch(baseUrl + f.target, { redirect: 'manual' }).catch(() => null);
      probed.set(f.target, res?.status === 200);
    }
  }
  findings = findings.filter((f) => !(f.code === 'broken-link' && probed.get(f.target)));
}

console.log(`Checked ${pages.length} pages (${baseUrl ?? '.next/server/app'}), max click depth ${maxDepth}\n`);
console.log('PAGE'.padEnd(40) + 'DEPTH  INBOUND');
for (const p of registry) {
  console.log(p.padEnd(40) + String(depth[p] === Infinity ? '-' : depth[p]).padEnd(7) + inbound[p]);
}
console.log();

const errors = findings.filter((f) => f.severity === 'error');
if (findings.length === 0) {
  console.log('OK: no findings.');
} else {
  console.log(formatTable(findings));
  console.log(`\n${errors.length} error(s), ${findings.length - errors.length} warning(s).`);
}
process.exit(errors.length > 0 ? 1 : 0);
