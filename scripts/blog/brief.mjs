// Usage: npm run blog:brief -- {slug} [--films path] [--articles dir]
// Prints the writer brief for one film (film record, tokens, wording rules, budgets, peers).
import { lib, parseArgs } from './_common.mjs';

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (err) {
  console.error(`blog:brief: ${err.message}`);
  process.exit(2);
}
const slug = args.positional[0];
if (args.help || !slug) {
  console.error('usage: npm run blog:brief -- {slug} [--films path] [--articles dir]');
  process.exit(args.help ? 0 : 2);
}

try {
  const { loadFilms, loadArticle } = lib('load');
  const { buildStats } = lib('stats');
  const { buildBrief } = lib('brief');
  const films = loadFilms(args.films);
  const film = films.find((f) => f.slug === slug);
  if (!film) {
    const near = films.filter((f) => f.slug.includes(slug.split('-')[0])).slice(0, 5).map((f) => f.slug);
    console.error(`blog:brief: no film with slug "${slug}" in films.json${near.length ? `. Did you mean: ${near.join(', ')}?` : ''}`);
    process.exit(2);
  }
  process.stdout.write(buildBrief({ film, films, stats: buildStats(films), existing: loadArticle(slug, args.articles) }));
} catch (err) {
  console.error(`blog:brief: ${err.message}`);
  process.exit(2);
}
