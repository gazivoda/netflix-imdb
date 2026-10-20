// Validates the prerendered pages from `next build` against lib/html-seo.ts, and every
// prerendered /blog/{slug} article plus the /blog hub against lib/blog-html.ts.
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
const { checkBlogPage, checkHubSize, checkRenderedSimilarity, unregisteredPages, HUB_MAX_BYTES } = require(
  join(root, 'lib/blog-html.ts'),
);
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

// Blog data (films.json + article files) is read only when the registry has article
// pages, so a repo with no articles (and no films.json) validates exactly as before.
// BLOG_DATA_DIR is honoured like in the build. No network.
let blogData = null;
const loadBlogData = () => {
  if (!blogData) {
    const { loadFilms, loadArticles } = require(join(root, 'lib/blog/load.ts'));
    blogData = { films: loadFilms(), articles: loadArticles() };
  }
  return blogData;
};

const articlePages = [];
let hubBytes = null;

for (const page of PAGES) {
  const file = join(appDir, htmlFileForPath(page.path));
  if (!existsSync(file)) {
    findings.push({ path: page.path, rule: 'build', message: `no prerendered HTML at ${relative(root, file)}` });
    continue;
  }
  checked.add(file);
  const html = readFileSync(file, 'utf8');
  findings.push(...checkPage({ path: page.path, html }));

  if (page.path === '/blog') {
    findings.push(...checkHubSize({ path: page.path, html }));
    hubBytes = Buffer.byteLength(html, 'utf8');
  } else if (page.kind === 'article') {
    const slug = page.path.slice('/blog/'.length);
    try {
      const { films, articles } = loadBlogData();
      const film = films.find((f) => f.slug === slug);
      const article = articles.find((a) => a.slug === slug);
      if (!film || !article) {
        findings.push({ path: page.path, rule: 'blog-data', message: `no ${film ? 'article file' : 'film'} for slug "${slug}" in the blog data` });
      } else {
        findings.push(...checkBlogPage({ path: page.path, html, film, article }));
      }
    } catch (err) {
      findings.push({ path: page.path, rule: 'blog-data', message: `cannot load blog data: ${err.message}` });
    }
    articlePages.push({ path: page.path, html });
  }
}

// Rendered article bodies must not read alike (pairwise 5-gram Jaccard).
findings.push(...checkRenderedSimilarity(articlePages));

// Any other prerendered page is public but not in the registry (so not in the sitemap).
// An unpublished article is not in the registry, so a page built for it is caught here too.
findings.push(
  ...unregisteredPages(
    walkHtml(appDir).map((file) => relative(appDir, file)),
    PAGES.map((p) => p.path),
  ),
);

// checkPage and checkBlogPage both check the h1; report each distinct finding once.
const seen = new Set();
const unique = findings.filter((f) => {
  const key = `${f.path}|${f.rule}|${f.message}`;
  return seen.has(key) ? false : (seen.add(key), true);
});
findings.length = 0;
findings.push(...unique);

if (findings.length) {
  console.error(`seo:validate: ${findings.length} finding(s)\n`);
  for (const f of findings) console.error(`  ${f.path}  [${f.rule}]  ${f.message}`);
  process.exit(1);
}
console.log(`seo:validate: ${checked.size} pages OK`);
if (articlePages.length) {
  const hub = hubBytes === null ? 'no hub page' : `hub ${(hubBytes / 1024).toFixed(1)} KB of ${HUB_MAX_BYTES / 1024} KB`;
  let titles = '';
  try {
    // Informational only: films whose generated title needs a shortTitle (R7). Never fails the run.
    const { titlesNeedingShortTitle } = require(join(root, 'lib/blog/title.ts'));
    const { films } = loadBlogData();
    titles = `, ${titlesNeedingShortTitle(films).length} of ${films.length} films need a shortTitle`;
  } catch {
    /* films.json not available: nothing to report */
  }
  console.log(`seo:validate: blog: ${articlePages.length} article pages, ${hub}${titles}`);
}
