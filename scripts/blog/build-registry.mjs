// Usage: npm run blog:registry
// Regenerates lib/blog/registry.generated.ts from data/blog/articles/*.json and
// data/blog/films.json (only articles with status "published") plus the hub state
// (ready only when films.json holds BLOG_EXPECT_FILMS films, default 100). With no
// articles or no films.json it writes the valid empty module (hub not ready). Local only; never runs in CI or at build.
// tests/blog/registry.test.ts fails when the committed file is stale.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../../..');
const require = createRequire(import.meta.url);

// lib/*.ts is shared with the app; transpile on the fly (same pattern as scripts/validate-seo.mjs).
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
});
const { generateRegistrySource, registryFilePath } = require(join(root, 'lib/blog/registry.ts'));

try {
  // BLOG_DATA_DIR (relative to the cwd) points the generator at another data directory, for
  // example tests/blog/fixtures with BLOG_EXPECT_FILMS=12 in a scratch build.
  const dataDir = process.env.BLOG_DATA_DIR?.trim() ? resolve(process.cwd(), process.env.BLOG_DATA_DIR.trim()) : undefined;
  const source = generateRegistrySource({ root, dataDir });
  const file = registryFilePath(root);
  let current = null;
  try {
    current = readFileSync(file, 'utf8');
  } catch {
    /* first run */
  }
  const count = (source.match(/^ {4}"path":/gm) ?? []).length;
  if (current === source) {
    console.log(`blog:registry: up to date (${count} published article${count === 1 ? '' : 's'}; hub ready: ${/"ready": true/.test(source)})`);
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
    console.log(`blog:registry: wrote lib/blog/registry.generated.ts (${count} published article${count === 1 ? '' : 's'}; hub ready: ${/"ready": true/.test(source)})`);
  }
} catch (err) {
  console.error(`blog:registry: ${err.message}`);
  process.exit(1);
}
