// The full per-article gate behind `npm run blog:check {slug}` (spec 7.1):
// schema, tokens, copy lint, plot overlap, lengths, links, and similarity against
// every other review-or-later article. Pure: callers load the data.

import { formatIssue, isWarning, issue, type Issue } from './issue';
import { checkLinks } from './links';
import { lintCopy, allStrings, isProsePath } from './lint';
import { validateArticleSchema } from './schema';
import { checkSimilarity, proseLengthIssues, type SimEntry } from './similarity';
import type { StatsBySlug } from './stats';
import { tokenProblems } from './tokens';
import type { Article, Film } from './types';

export const SIMILARITY_STATUSES: Article['status'][] = ['review', 'checked', 'published'];

export interface CheckInputs {
  films: Film[];
  stats: StatsBySlug;
  /** Every article on disk (the target may be among them). */
  articles: Article[];
  /** Registered page paths (lib/pages.ts). */
  registeredPaths: string[];
  /** File name of the target, to check slug vs file name. */
  fileName?: string;
  /**
   * Compare against every other article, drafts included (`blog:check --all`). The default
   * compares only with review, checked and published articles, so a writer's first pass is not
   * blocked by half-written neighbours; the integrator runs --all after each wave.
   */
  includeDrafts?: boolean;
  /**
   * Extra comparison entries that are not in `articles`, with their own film and stats: the
   * worked example of docs/blog/WRITER-BRIEF.md (tests/blog/fixtures/worked-example.json), so no
   * article can imitate its sentence frames. An entry whose slug equals the target is skipped.
   */
  extraOthers?: SimEntry[];
  /**
   * IMDb ids of accepted matches still awaiting a human identity decision
   * (data/blog/source/doubtful.json without an override). Such an article fails.
   */
  doubtfulIds?: string[];
}

/** Statuses an article is compared against. */
export const comparisonStatuses = (includeDrafts = false): Article['status'][] =>
  includeDrafts ? ['draft', ...SIMILARITY_STATUSES] : SIMILARITY_STATUSES;

/** The comparison set for `target`: other articles of the chosen statuses plus the extra entries. */
export function comparisonEntries(target: Article, inputs: Omit<CheckInputs, 'registeredPaths'>): SimEntry[] {
  const statuses = comparisonStatuses(inputs.includeDrafts);
  const others: SimEntry[] = [];
  const seen = new Set<string>([target.slug]);
  for (const o of inputs.articles) {
    if (seen.has(o.slug) || !statuses.includes(o.status)) continue;
    const of = inputs.films.find((f) => f.slug === o.slug);
    if (of) {
      others.push({ article: o, film: of, stats: inputs.stats[of.slug] });
      seen.add(o.slug);
    }
  }
  for (const e of inputs.extraOthers ?? []) {
    if (seen.has(e.article.slug)) continue;
    others.push(e);
    seen.add(e.article.slug);
  }
  return others;
}

export interface CheckSection {
  name: string;
  issues: Issue[];
}

export interface CheckReport {
  slug: string;
  status: string;
  sections: CheckSection[];
  /** True when there are no errors; warnings do not fail. */
  ok: boolean;
  /** Number of errors (warnings excluded). */
  total: number;
  /** Number of warnings. */
  warnings: number;
}

const SECTION_ORDER = ['schema', 'tokens', 'copy', 'plot-overlap', 'lengths', 'links', 'similarity'] as const;

export function checkArticle(article: Article, inputs: CheckInputs): CheckReport {
  const film = inputs.films.find((f) => f.slug === article.slug);
  const stats = film ? inputs.stats[film.slug] : undefined;
  const sections: CheckSection[] = [];
  const add = (name: (typeof SECTION_ORDER)[number], issues: Issue[]): void => void sections.push({ name, issues });

  const schema = validateArticleSchema(article, { film, stats, fileName: inputs.fileName });
  if (inputs.doubtfulIds?.includes(article.imdbId)) {
    schema.push(
      issue(
        'identity-doubtful',
        `${article.imdbId} is listed in data/blog/source/doubtful.json (OMDb year before the first Netflix chart year): a human must confirm the film with an identity override in overrides.json, then re-run blog:refresh`,
        'imdbId',
      ),
    );
  }
  add('schema', schema);

  if (!film || !stats) {
    // nothing else can be checked without the film record
    for (const name of SECTION_ORDER.slice(1)) add(name, []);
  } else {
    const tokenIssues: Issue[] = [];
    for (const s of allStrings(article).filter((x) => isProsePath(x.where))) {
      for (const msg of tokenProblems(s.text, { film, stats, sources: article.sources })) {
        tokenIssues.push(issue('token', msg, s.where));
      }
    }
    add('tokens', tokenIssues);

    const copy = lintCopy(article, { film, stats });
    add('copy', copy.filter((i) => i.rule !== 'plot-overlap'));
    add('plot-overlap', copy.filter((i) => i.rule === 'plot-overlap'));
    add('lengths', proseLengthIssues(article));
    add('links', checkLinks(article, { registeredPaths: inputs.registeredPaths, filmSlugs: inputs.films.map((f) => f.slug) }));

    const others = comparisonEntries(article, inputs);
    const sim = checkSimilarity({ article, film, stats }, others).filter((i) => i.rule !== 'prose-length' && i.rule !== 'prose-aim');
    add('similarity', sim);
  }

  const all = sections.flatMap((s) => s.issues);
  const warnings = all.filter(isWarning).length;
  const total = all.length - warnings;
  return { slug: article.slug, status: article.status, sections, ok: total === 0, total, warnings };
}

/** Plain-text report for the terminal. */
export function formatReport(r: CheckReport, comparedWith: number, scope = 'review+'): string {
  const lines = [`blog:check ${r.slug}  (status: ${r.status}; similarity compared with ${comparedWith} other ${scope} article${comparedWith === 1 ? '' : 's'})`];
  for (const s of r.sections) {
    const errors = s.issues.filter((i) => !isWarning(i)).length;
    const warns = s.issues.length - errors;
    const note = [errors ? `${errors}` : '', warns ? `${warns} warning${warns === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ');
    lines.push(`  ${errors ? 'FAIL' : 'PASS'}  ${s.name}${note ? ` (${note})` : ''}`);
    for (const i of s.issues) lines.push(`        ${formatIssue(i)}`);
  }
  const warnNote = r.warnings ? ` (${r.warnings} warning${r.warnings === 1 ? '' : 's'}, not failures)` : '';
  lines.push(r.ok ? `RESULT: PASS${warnNote}` : `RESULT: FAIL (${r.total} finding${r.total === 1 ? '' : 's'})${warnNote}`);
  return lines.join('\n');
}
