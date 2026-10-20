// Usage: npm run blog:check -- {slug} [--films path] [--articles dir] [--all]
//        npm run blog:check -- --all
// Runs schema, tokens, copy lint, plot overlap, lengths, links and similarity. Similarity compares
// with every other review+ article and the WRITER-BRIEF worked example; with --all it also compares
// with drafts (and, without a slug, checks every article). Exit 0 only when everything passes
// (1 = findings, 2 = usage/IO error).
import { lib, pages, parseArgs, root } from './_common.mjs';

const USAGE =
  'usage: npm run blog:check -- {slug} [--films path] [--articles dir] [--all]\n' +
  '       npm run blog:check -- --all     (every article, compared with every other article including drafts)';

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (err) {
  console.error(`blog:check: ${err.message}\n${USAGE}`);
  process.exit(2);
}
const slug = args.positional[0];
if (args.help || (!slug && !args.all)) {
  console.error(USAGE);
  process.exit(args.help ? 0 : 2);
}

try {
  const { loadFilms, loadArticleFiles, defaultFilmsPath } = lib('load');
  const { buildStats } = lib('stats');
  const { checkArticle, comparisonEntries, formatReport } = lib('check');
  const { loadDoubtfulIds, loadWorkedExampleEntry } = lib('check-inputs');
  const filmsPath = args.films ?? defaultFilmsPath();
  const films = loadFilms(filmsPath);
  const files = loadArticleFiles(args.articles);
  const articles = files.map((f) => f.article);
  const stats = buildStats(films);
  const registeredPaths = pages().PAGES.map((p) => p.path);
  const worked = loadWorkedExampleEntry(root);
  const inputs = {
    films,
    stats,
    articles,
    registeredPaths,
    includeDrafts: args.all,
    extraOthers: worked ? [worked] : [],
    doubtfulIds: loadDoubtfulIds(filmsPath),
  };

  const targets = slug ? files.filter((f) => f.article.slug === slug) : files;
  if (targets.length === 0) {
    console.error(
      slug
        ? `blog:check: no article file for slug "${slug}" (expected data/blog/articles/${slug}.json)`
        : 'blog:check: no article files found',
    );
    process.exit(2);
  }

  const scope = args.all ? 'draft+' : 'review+';
  let failed = 0;
  for (const t of targets) {
    const report = checkArticle(t.article, { ...inputs, fileName: t.file });
    console.log(formatReport(report, comparisonEntries(t.article, inputs).length, scope));
    if (!report.ok) failed++;
  }
  if (targets.length > 1) console.log(`\n${targets.length - failed} of ${targets.length} articles pass`);
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error(`blog:check: ${err.message}`);
  process.exit(2);
}
