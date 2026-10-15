// Validates the prerendered pages from `next build` against lib/html-seo.ts.
// Usage: next build && npm run seo:validate   (exits 1 on any finding)

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const require = createRequire(import.meta.url);

// lib/*.ts is shared with the app; transpile on the fly instead of duplicating it.
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
});
const { checkPage, htmlFileForPath } = require(join(root, 'lib/html-seo.ts'));
const { PAGES } = require(join(root, 'lib/pages.ts'));

const appDir = join(root, '.next/server/app');
if (!existsSync(appDir)) {
  console.error('seo:validate: .next/server/app not found. Run `next build` first.');
  process.exit(1);
}

const walkHtml = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walkHtml(p) : name.endsWith('.html') ? [p] : [];
  });

const findings = [];
const checked = new Set();

for (const page of PAGES) {
  const file = join(appDir, htmlFileForPath(page.path));
  if (!existsSync(file)) {
    findings.push({ path: page.path, rule: 'build', message: `no prerendered HTML at ${relative(root, file)}` });
    continue;
  }
  checked.add(file);
  findings.push(...checkPage({ path: page.path, html: readFileSync(file, 'utf8') }));
}

// Any other prerendered page is public but not in the registry (so not in the sitemap).
for (const file of walkHtml(appDir)) {
  const rel = relative(appDir, file);
  if (checked.has(file) || rel === '_not-found.html') continue;
  findings.push({ path: `/${rel}`, rule: 'registry', message: 'prerendered page is not in lib/pages.ts' });
}

if (findings.length) {
  console.error(`seo:validate: ${findings.length} finding(s)\n`);
  for (const f of findings) console.error(`  ${f.path}  [${f.rule}]  ${f.message}`);
  process.exit(1);
}
console.log(`seo:validate: ${checked.size} pages OK`);
