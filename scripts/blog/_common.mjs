// Shared CLI plumbing for blog:brief and blog:check: registers ts-node (same
// pattern as scripts/validate-seo.mjs) so lib/blog/*.ts runs on Node 20.
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(fileURLToPath(import.meta.url), '../../..');
const require = createRequire(import.meta.url);

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
});

export const lib = (name) => require(join(root, 'lib/blog', `${name}.ts`));
export const pages = () => require(join(root, 'lib/pages.ts'));

/** Minimal flag parser: positional args plus --films <path>, --articles <dir>, --all. */
export function parseArgs(argv) {
  const out = { positional: [], films: undefined, articles: undefined, all: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--films') out.films = resolve(argv[++i] ?? '');
    else if (a === '--articles') out.articles = resolve(argv[++i] ?? '');
    else if (a === '--all') out.all = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else out.positional.push(a);
  }
  return out;
}
