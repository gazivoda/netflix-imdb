import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { BLOG_ARTICLE_PAGES, BLOG_HUB } from '../../lib/blog/registry.generated';
import {
  DEFAULT_EXPECT_FILMS,
  HUB_NOT_READY,
  buildRegistryEntries,
  expectedFilmCount,
  generateRegistrySource,
  hubState,
  registryFilePath,
  renderRegistryModule,
} from '../../lib/blog/registry';
import { generatedTitle } from '../../lib/blog/title';
import { clone, filmBySlug, loadFixtureArticles, loadFixtureFilms } from './fixtures';

const ROOT = join(__dirname, '../..');
const films = loadFixtureFilms();
const articles = loadFixtureArticles();

describe('registry.generated.ts', () => {
  it('equals an in-memory regeneration from data/blog (run `npm run blog:registry` if this fails)', () => {
    const onDisk = readFileSync(registryFilePath(ROOT), 'utf8');
    expect(onDisk).toBe(generateRegistrySource({ root: ROOT }));
  });

  it('is a valid, importable array', () => {
    expect(Array.isArray(BLOG_ARTICLE_PAGES)).toBe(true);
  });

  it('holds only published articles', () => {
    const dir = join(ROOT, 'data/blog/articles');
    const published = existsSync(dir)
      ? readdirSync(dir)
          .filter((n) => n.endsWith('.json'))
          .map((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')))
          .filter((a) => a.status === 'published')
          .map((a) => `/blog/${a.slug}`)
      : [];
    expect(BLOG_ARTICLE_PAGES.map((p) => p.path).sort()).toEqual(published.sort());
  });
});

describe('buildRegistryEntries (fixtures)', () => {
  const entries = buildRegistryEntries(films, articles);

  it('keeps only articles with status published', () => {
    expect(entries.map((e) => e.path)).toEqual(['/blog/harbor-lights-2021']);
  });

  it('fills path, R7 title, rendered description, label and scores', () => {
    const film = filmBySlug('harbor-lights-2021');
    const [e] = entries;
    expect(e.title).toBe(generatedTitle(film).title);
    expect(e.title).toBe('Harbor Lights (2021): IMDb 7.8 vs RT 91%');
    expect(e.label).toBe('Harbor Lights (2021)');
    expect(e.description).not.toContain('{{');
    expect(e.description).toContain('7.8');
    expect(e.description).toContain('91%');
    expect(e.scores).toEqual({ imdb: 7.8, rt: 91, gap: 13, asOf: '2026-10-15' });
    expect(e.imdbId).toBe(film.omdb.imdbId);
  });

  it('applies R14: published from the article, updated = max(published, contentUpdated, dataChangedAt)', () => {
    expect(entries[0].published).toBe('2026-10-20');
    expect(entries[0].updated).toBe('2026-10-20');

    const later = clone(films);
    later.find((f) => f.slug === 'harbor-lights-2021')!.dataChangedAt = '2026-11-02';
    expect(buildRegistryEntries(later, articles)[0].updated).toBe('2026-11-02');

    const edited = clone(articles);
    const a = edited.find((x) => x.slug === 'harbor-lights-2021')!;
    a.contentUpdated = '2026-12-01';
    expect(buildRegistryEntries(films, edited)[0].updated).toBe('2026-12-01');
  });

  it('uses shortTitle when the full forms do not fit', () => {
    const longFilms = clone(films);
    const f = longFilms.find((x) => x.slug === 'harbor-lights-2021')!;
    f.omdb.title = 'Harbor Lights of the Northern Coast and Beyond';
    const withShort = clone(articles);
    withShort.find((x) => x.slug === 'harbor-lights-2021')!.shortTitle = 'Harbor Lights';
    expect(buildRegistryEntries(longFilms, withShort)[0].title).toBe('Harbor Lights: IMDb 7.8 vs RT 91%');
  });

  it('orders entries by popularity rank and is deterministic', () => {
    const all = clone(articles).map((a) => ({ ...a, status: 'published' as const, published: '2026-10-20' }));
    const out = buildRegistryEntries(films, all);
    const ranks = out.map((e) => films.find((f) => `/blog/${f.slug}` === e.path)!.popularityRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(JSON.stringify(buildRegistryEntries(films, [...all].reverse()))).toBe(JSON.stringify(out));
  });

  it('fails loudly when a published article has no film, a bad date or an unknown token', () => {
    const orphan = clone(articles).map((a) => (a.status === 'published' ? { ...a, slug: 'nope-2020' } : a));
    expect(() => buildRegistryEntries(films, orphan)).toThrow(/nope-2020/);
    const noDate = clone(articles).map((a) => (a.status === 'published' ? { ...a, published: null } : a));
    expect(() => buildRegistryEntries(films, noDate)).toThrow(/published/);
    const badToken = clone(articles).map((a) => (a.status === 'published' ? { ...a, description: 'Bad {{nope}} token.' } : a));
    expect(() => buildRegistryEntries(films, badToken)).toThrow();
  });
});

describe('renderRegistryModule', () => {
  it('renders a valid empty module', () => {
    const src = renderRegistryModule([]);
    expect(src).toMatch(/export const BLOG_ARTICLE_PAGES: readonly BlogArticlePage\[\] = \[\];/);
    expect(src).toContain('GENERATED');
  });

  it('round-trips entries as static data (no imports, no fs)', () => {
    const src = renderRegistryModule(buildRegistryEntries(films, articles));
    expect(src).not.toMatch(/^import /m);
    expect(src).not.toMatch(/require\(|readFileSync/);
    expect(src).toContain('/blog/harbor-lights-2021');
    expect(src.endsWith('\n')).toBe(true);
  });
});

describe('generateRegistrySource with no data', () => {
  it('produces the empty module when there is no films.json and no articles', () => {
    const src = generateRegistrySource({ root: join(__dirname, 'fixtures/does-not-exist') });
    expect(src).toBe(renderRegistryModule([]));
    expect(src).toBe(renderRegistryModule([], HUB_NOT_READY));
    expect(src).toMatch(/export const BLOG_HUB: BlogHubState = \{\s*"ready": false,\s*"dataUpdated": null\s*\};/);
  });
});

// I9 + I10: the hub is public only when films.json holds exactly the expected number of films.
describe('hub state (I9 gating, I10 lastmod)', () => {
  const FIXTURES = join(__dirname, 'fixtures');

  it('the committed module carries a hub state (not ready while data/blog/films.json is absent)', () => {
    expect(typeof BLOG_HUB.ready).toBe('boolean');
    if (!existsSync(join(ROOT, 'data/blog/films.json'))) expect(BLOG_HUB).toEqual({ ready: false, dataUpdated: null });
  });

  it('is ready only with exactly the expected film count, and dataUpdated = max(dataChangedAt)', () => {
    expect(hubState(null, 100)).toEqual({ ready: false, dataUpdated: null });
    expect(hubState(films, 100)).toEqual({ ready: false, dataUpdated: '2026-10-15' });
    expect(hubState(films, 12)).toEqual({ ready: true, dataUpdated: '2026-10-15' });
    const later = clone(films);
    later[7].dataChangedAt = '2026-11-09';
    expect(hubState(later, 12).dataUpdated).toBe('2026-11-09');
    expect(hubState(later.slice(0, 11), 12).ready).toBe(false);
  });

  it('reads the threshold from BLOG_EXPECT_FILMS (default 100) and rejects junk', () => {
    expect(DEFAULT_EXPECT_FILMS).toBe(100);
    expect(expectedFilmCount({})).toBe(100);
    expect(expectedFilmCount({ BLOG_EXPECT_FILMS: '12' })).toBe(12);
    expect(expectedFilmCount({ BLOG_EXPECT_FILMS: ' ' })).toBe(100);
    expect(() => expectedFilmCount({ BLOG_EXPECT_FILMS: 'ten' })).toThrow(/BLOG_EXPECT_FILMS/);
    expect(() => expectedFilmCount({ BLOG_EXPECT_FILMS: '0' })).toThrow(/BLOG_EXPECT_FILMS/);
  });

  it('fixture data with a matching threshold yields a ready hub and the published entry', () => {
    const src = generateRegistrySource({ root: ROOT, dataDir: FIXTURES, expectFilms: 12 });
    expect(src).toMatch(/"ready": true/);
    expect(src).toMatch(/"dataUpdated": "2026-10-15"/);
    expect(src).toContain('/blog/harbor-lights-2021');
  });

  it('refuses to register a published article while the hub is not ready (no article may link a 404 hub)', () => {
    expect(() => generateRegistrySource({ root: ROOT, dataDir: FIXTURES, expectFilms: 100 })).toThrow(/hub is not ready/);
  });
});

// ---------------------------------------------------------------------------------------------
// Import hygiene (spec 2.4, 6.1): the page registry never reads the filesystem, and blog code
// never touches the runtime OMDb / ratings store.

const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mjs|js)$/.test(n) ? [p] : [];
      })
    : [];

const importSpecifiers = (src: string): string[] =>
  [...src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? m[4],
  );

describe('import hygiene', () => {
  it('lib/pages.ts imports no blog loader and no fs', () => {
    const specs = importSpecifiers(readFileSync(join(ROOT, 'lib/pages.ts'), 'utf8'));
    expect(specs.some((s) => /blog\/load/.test(s))).toBe(false);
    expect(specs.some((s) => /^(node:)?fs(\/|$)/.test(s))).toBe(false);
    expect(specs).toContain('./blog/registry.generated');
  });

  it('registry.generated.ts is static data (no imports)', () => {
    expect(importSpecifiers(readFileSync(join(ROOT, 'lib/blog/registry.generated.ts'), 'utf8'))).toEqual([]);
  });

  it.each(['lib/blog', 'app/blog'])('%s imports no omdb, cached-omdb or ratings-store', (dir) => {
    for (const file of walk(join(ROOT, dir))) {
      for (const spec of importSpecifiers(readFileSync(file, 'utf8'))) {
        expect(`${file}: ${spec}`).not.toMatch(/(^|\/)(omdb|cached-omdb|ratings-store)(\.[a-z]+)?$/);
      }
    }
  });

  it('no file under app/blog is a client component', () => {
    for (const file of walk(join(ROOT, 'app/blog'))) {
      expect(`${file}: ${/^\s*['"]use client['"]/m.test(readFileSync(file, 'utf8'))}`).toMatch(/: false$/);
    }
  });
});
