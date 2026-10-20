// The worked example printed in docs/blog/WRITER-BRIEF.md section 9 is a real fixture
// (tests/blog/fixtures/worked-example.json) that blog:check compares every article with (I6).
import { readFileSync } from 'fs';
import { join } from 'path';
import { checkArticle } from '../../lib/blog/check';
import { loadWorkedExampleEntry, WORKED_EXAMPLE_PATH } from '../../lib/blog/check-inputs';
import { proseWordCount } from '../../lib/blog/similarity';
import { buildStats } from '../../lib/blog/stats';
import type { Article } from '../../lib/blog/types';
import { PAGES } from '../../lib/pages';
import { loadFixtureArticles, loadFixtureFilms } from './fixtures';

const ROOT = join(__dirname, '../..');
const worked = JSON.parse(readFileSync(join(ROOT, WORKED_EXAMPLE_PATH), 'utf8')) as Article;

describe('WRITER-BRIEF worked example', () => {
  it('the JSON block in the brief equals tests/blog/fixtures/worked-example.json', () => {
    const doc = readFileSync(join(ROOT, 'docs/blog/WRITER-BRIEF.md'), 'utf8');
    const section = doc.slice(doc.indexOf('## 9. Worked example'));
    const block = /```json\n([\s\S]*?)\n```/.exec(section)?.[1];
    expect(block).toBeDefined();
    expect(JSON.parse(block as string)).toEqual(worked);
  });

  it('has status review and empty fact-check fields (the form a writer submits)', () => {
    expect(worked.status).toBe('review');
    expect(worked.published).toBeNull();
    expect(worked.review.factChecker).toBeNull();
    expect(worked.review.factCheckedOn).toBeNull();
  });

  it('is the crimson-static fixture apart from status and review', () => {
    const fixture = loadFixtureArticles().find((a) => a.slug === worked.slug)!;
    const strip = ({ status: _s, review: _r, ...rest }: Article) => rest;
    expect(strip(worked)).toEqual(strip(fixture));
  });

  it('passes every check and meets the 750-word target it asks writers for', () => {
    const films = loadFixtureFilms();
    const others = loadFixtureArticles().filter((a) => a.slug !== worked.slug);
    const r = checkArticle(worked, { films, stats: buildStats(films), articles: [...others, worked], registeredPaths: PAGES.map((p) => p.path) });
    expect(r.sections.flatMap((s) => s.issues)).toEqual([]);
    expect(proseWordCount(worked)).toBeGreaterThanOrEqual(750);
  });

  it('avoids the sentence frames the review found shared between the first articles', () => {
    const prose = [worked.summary, ...worked.sections.flatMap((s) => s.paragraphs), ...worked.faq.map((f) => f.a)].join(' ');
    expect(prose).not.toMatch(/\{\{imdb\}\} from \{\{votesShort\}\} votes/);
    expect(prose).not.toMatch(/ranks \{\{gapRank\}\} of \{\{setSize\}\}/);
    expect(prose).not.toMatch(/IMDb reads \{\{imdbX10\}\} and Rotten Tomatoes reads/);
  });

  it('loadWorkedExampleEntry gives blog:check the example with its fixture film', () => {
    const e = loadWorkedExampleEntry(ROOT)!;
    expect(e.article).toEqual(worked);
    expect(e.film.slug).toBe(worked.slug);
    expect(e.stats.archetype).toBe('audience-higher');
  });
});
