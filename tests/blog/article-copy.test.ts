// Spec 6.1 article-copy: runs the copy lint over every article JSON string and the
// rendered display titles. The raw regex block repeats the spec rules independently
// of lib/blog/lint.ts so a regression in the lint cannot hide a violation here.
import { existsSync } from 'fs';
import { allStrings, lintCopy, lintDisplayTitle } from '../../lib/blog/lint';
import { defaultFilmsPath, loadFilms } from '../../lib/blog/load';
import { displayTitle } from '../../lib/blog/format';
import { formatIssue } from '../../lib/blog/issue';
import { buildStats } from '../../lib/blog/stats';
import { loadFixtureArticles, loadFixtureFilms } from './fixtures';
import { loadCorpus } from './fixtures/corpus';

const films = loadFixtureFilms();
const stats = buildStats(films);
const articles = loadFixtureArticles();

const RAW_RULES: [string, RegExp][] = [
  ['pictographic', /\p{Extended_Pictographic}/u],
  ['en/em dash or bar', /[\u2013\u2014\u2015]/],
  ['arrow', /[\u2190-\u21FF\u27F0-\u27FF\u2900-\u297F\u2B00-\u2BFF]/],
  ['bullet', /\u2022/],
  ['middle dot', /\u00B7/],
  ['ascii arrow', /->|=>|<-/],
];
const HEX = /#[0-9a-fA-F]{3,8}\b/;

describe('fixture articles: raw copy rules on every JSON string', () => {
  for (const a of articles) {
    it(`${a.slug}: no banned glyphs, hex colours or ASCII arrows`, () => {
      for (const s of allStrings(a)) {
        for (const [label, re] of RAW_RULES) expect({ where: s.where, label, hit: re.test(s.text) }).toEqual({ where: s.where, label, hit: false });
        if (!/url$/.test(s.where)) expect({ where: s.where, hit: HEX.test(s.text) }).toEqual({ where: s.where, hit: false });
      }
    });

    it(`${a.slug}: passes the full copy lint`, () => {
      const film = films.find((f) => f.slug === a.slug)!;
      expect(lintCopy(a, { film, stats: stats[a.slug] }).map(formatIssue)).toEqual([]);
    });
  }

  it('rendered display titles of the fixture films are clean', () => {
    for (const f of films) {
      expect(displayTitle(f.omdb.title)).not.toMatch(/[\u2013\u2014\u2015]/);
      expect(lintDisplayTitle(f)).toEqual([]);
    }
  });
});

describe('real corpus (skipped while data/blog is empty or missing)', () => {
  it('every rendered display title in films.json is clean', () => {
    if (!existsSync(defaultFilmsPath())) return;
    for (const f of loadFilms()) expect({ slug: f.slug, issues: lintDisplayTitle(f) }).toEqual({ slug: f.slug, issues: [] });
  });

  it('every article passes the copy lint', () => {
    const corpus = loadCorpus();
    if (!corpus) return;
    for (const a of corpus.articles) {
      const film = corpus.films.find((f) => f.slug === a.slug)!;
      expect({ slug: a.slug, issues: lintCopy(a, { film, stats: corpus.stats[a.slug] }).map(formatIssue) }).toEqual({ slug: a.slug, issues: [] });
    }
  });
});
