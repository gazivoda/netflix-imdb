import { spawnSync } from 'child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PAGES } from '../../lib/pages';
import { checkArticle, formatReport, SIMILARITY_STATUSES } from '../../lib/blog/check';
import { buildBrief } from '../../lib/blog/brief';
import { buildStats } from '../../lib/blog/stats';
import type { Article } from '../../lib/blog/types';
import { clone, filmBySlug, FIXTURE_ARTICLES_DIR, FIXTURE_FILMS_PATH, loadFixtureArticles, loadFixtureFilms } from './fixtures';

const films = loadFixtureFilms();
const stats = buildStats(films);
const articles = loadFixtureArticles();
const registeredPaths = PAGES.map((p) => p.path);
const inputs = (list = articles) => ({ films, stats, articles: list, registeredPaths });
const get = (slug: string) => articles.find((a) => a.slug === slug)!;
const section = (r: ReturnType<typeof checkArticle>, name: string) => r.sections.find((s) => s.name === name)!;

describe('checkArticle', () => {
  it.each(articles.map((a) => [a.slug, a] as const))('%s passes every section', (_s, a) => {
    const r = checkArticle(a, { ...inputs(), fileName: `${a.slug}.json` });
    expect(r.sections.map((s) => s.name)).toEqual(['schema', 'tokens', 'copy', 'plot-overlap', 'lengths', 'links', 'similarity']);
    expect({ total: r.total, issues: r.sections.flatMap((s) => s.issues) }).toEqual({ total: 0, issues: [] });
    expect(r.ok).toBe(true);
  });

  it('reports a schema problem, a bad token, a banned phrase and plot overlap in their own sections', () => {
    const a = clone(get('harbor-lights-2021'));
    a.h1 = 'Harbor Lights';
    a.sections[1].paragraphs[0] += ' {{metascor}} It is an invented plot about a lighthouse keeper, a tapestry.';
    const r = checkArticle(a, inputs());
    expect(r.ok).toBe(false);
    expect(section(r, 'schema').issues.map((i) => i.rule)).toContain('h1');
    expect(section(r, 'tokens').issues.map((i) => i.message).join('|')).toMatch(/metascor/);
    expect(section(r, 'copy').issues.map((i) => i.rule)).toContain('banned-phrase');
    expect(section(r, 'plot-overlap').issues).toHaveLength(1);
  });

  it('reports lengths separately from similarity', () => {
    const a = clone(get('harbor-lights-2021'));
    a.faq = a.faq.slice(0, 2);
    a.sections = a.sections.map((s) => (s.id === 'who-it-suits' ? { ...s, paragraphs: s.paragraphs.slice(0, 1) } : s));
    a.sections[0].paragraphs = a.sections[0].paragraphs.slice(0, 3);
    const r = checkArticle(a, inputs());
    expect(section(r, 'lengths').issues.map((i) => i.rule)).toEqual(['prose-length']);
    expect(section(r, 'similarity').issues.map((i) => i.rule)).not.toContain('prose-length');
  });

  it('compares against other review-or-later articles only, never drafts or itself', () => {
    const copy = clone(get('crimson-static-2022'));
    copy.slug = 'velvet-orbit-2023'; // any slug with a film record
    copy.status = 'review';
    const target = clone(get('crimson-static-2022'));
    expect(section(checkArticle(target, inputs([target, copy])), 'similarity').issues.length).toBeGreaterThan(0);
    copy.status = 'draft';
    expect(section(checkArticle(target, inputs([target, copy])), 'similarity').issues).toEqual([]);
    expect(SIMILARITY_STATUSES).toEqual(['review', 'checked', 'published']);
  });

  it('flags an article with no film and skips the rest', () => {
    const a = clone(get('harbor-lights-2021'));
    a.slug = 'ghost-2000';
    const r = checkArticle(a, inputs());
    expect(section(r, 'schema').issues.map((i) => i.rule)).toContain('film-missing');
    expect(r.ok).toBe(false);
  });

  it('formatReport prints PASS/FAIL lines and a result', () => {
    const ok = formatReport(checkArticle(get('harbor-lights-2021'), inputs()), 3);
    expect(ok).toContain('PASS  schema');
    expect(ok).toContain('RESULT: PASS');
    const a = clone(get('harbor-lights-2021'));
    a.h1 = 'Harbor Lights';
    const bad = formatReport(checkArticle(a, inputs()), 3);
    expect(bad).toMatch(/FAIL {2}schema \(\d+\)/);
    expect(bad).toMatch(/RESULT: FAIL \(\d+ findings?\)/);
  });
});

describe('buildBrief', () => {
  const brief = (slug: string) => buildBrief({ film: films.find((f) => f.slug === slug)!, films, stats, existing: articles.find((a) => a.slug === slug) });

  it('prints record, tokens, wording, budgets, peers, related and banned phrases', () => {
    const b = brief('harbor-lights-2021');
    for (const part of [
      'WRITER BRIEF: Harbor Lights (2021)',
      '{{imdb}}',
      '7.8',
      'tier: clear',
      'archetype: critics-higher',
      'use: a clear gap | noticeably higher | disagree',
      'never: wide; large; big; sharp; split; huge; massive; enormous; chasm; very wide; widest',
      'GENRE PEERS (Drama)',
      'RELATED LINKS',
      'BANNED PHRASES',
      'delve',
      'section why-split: 150-260 words',
      'generated <title> (full): Harbor Lights (2021): IMDb 7.8 vs RT 91%',
    ]) {
      expect(b).toContain(part);
    }
  });

  it('flags null-valued tokens and an R15 requirement', () => {
    expect(brief('midnight-ferry-2025')).toMatch(/\{\{metascore\}\}\s+NULL/);
    expect(brief('velvet-orbit-2023')).toContain('REQUIRED: abs gap 33');
  });

  it('shows the Netflix runtime as not published when null', () => {
    expect(brief('echo-valley-2021')).toContain('runtime per Netflix: not published');
  });
});

describe('CLIs (spawned with the fixture data)', () => {
  const run = (script: string, ...args: string[]) =>
    spawnSync(process.execPath, [join(__dirname, '../../scripts/blog', script), ...args, '--films', FIXTURE_FILMS_PATH, '--articles', FIXTURE_ARTICLES_DIR], { encoding: 'utf8' });

  it('blog:check exits 0 for a passing fixture and prints PASS', () => {
    const r = run('check.mjs', 'salt-and-iron-2019');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('RESULT: PASS');
  });

  it('blog:check --all checks every article, drafts included', () => {
    const r = run('check.mjs', '--all');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('4 of 4 articles pass');
    expect(r.stdout).toContain('other draft+ articles');
  });

  it('usage lines show the npm "--" separator (I9)', () => {
    const c = spawnSync(process.execPath, [join(__dirname, '../../scripts/blog/check.mjs')], { encoding: 'utf8' });
    expect(c.stderr).toContain('npm run blog:check -- {slug} [--films path]');
    const b = spawnSync(process.execPath, [join(__dirname, '../../scripts/blog/brief.mjs')], { encoding: 'utf8' });
    expect(b.stderr).toContain('npm run blog:brief -- {slug} [--films path]');
    expect(run('brief.mjs', 'harbor-lights-2021').stdout).toContain('finish with: npm run blog:check -- harbor-lights-2021');
  });

  describe('comparison set (I6) and identity gate (C1)', () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'blog-check-'));
      mkdirSync(join(dir, 'articles'));
      mkdirSync(join(dir, 'source'));
      copyFileSync(FIXTURE_FILMS_PATH, join(dir, 'films.json'));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));
    const runIn = (...args: string[]) =>
      spawnSync(process.execPath, [join(__dirname, '../../scripts/blog/check.mjs'), ...args, '--films', join(dir, 'films.json'), '--articles', join(dir, 'articles')], { encoding: 'utf8' });
    const write = (a: Article) => writeFileSync(join(dir, 'articles', `${a.slug}.json`), JSON.stringify(a, null, 2));
    /** The worked example moved onto another fixture film (velvet-orbit: also audience-higher). */
    const copyOfWorkedExample = (status: Article['status']): Article => {
      const a = JSON.parse(readFileSync(join(__dirname, 'fixtures/worked-example.json'), 'utf8')) as Article;
      const swap = (t: string) => t.replace(/Crimson Static/g, 'Velvet Orbit');
      a.slug = 'velvet-orbit-2023';
      a.imdbId = filmBySlug('velvet-orbit-2023').omdb.imdbId;
      a.status = status;
      a.h1 = swap(a.h1);
      a.sections.forEach((s) => (s.heading = swap(s.heading)));
      a.faq.forEach((f) => (f.q = swap(f.q)));
      return a;
    };

    it('the WRITER-BRIEF worked example is in the default comparison set', () => {
      write(copyOfWorkedExample('draft'));
      const r = runIn('velvet-orbit-2023');
      expect(r.status).toBe(1);
      expect(r.stdout).toMatch(/\[jaccard\].*crimson-static-2022 vs velvet-orbit-2023/);
    });

    it('drafts are compared only with --all', () => {
      write(copyOfWorkedExample('draft'));
      const target = loadFixtureArticles().find((a) => a.slug === 'salt-and-iron-2019')!;
      const dup = clone(target);
      dup.slug = 'glass-harvest-2022';
      dup.imdbId = filmBySlug('glass-harvest-2022').omdb.imdbId;
      dup.status = 'draft';
      write(target);
      write(dup);
      expect(runIn('salt-and-iron-2019').stdout).not.toContain('glass-harvest-2022');
      const all = runIn('salt-and-iron-2019', '--all');
      expect(all.status).toBe(1);
      expect(all.stdout).toMatch(/glass-harvest-2022 vs salt-and-iron-2019/);
    });

    it('an article whose film is still DOUBTFUL fails until an identity override exists', () => {
      const target = loadFixtureArticles().find((a) => a.slug === 'salt-and-iron-2019')!;
      write(target);
      const entry = { imdbId: target.imdbId, outcome: 'eligible', override: false };
      writeFileSync(join(dir, 'source', 'doubtful.json'), JSON.stringify({ entries: [entry] }));
      const r = runIn('salt-and-iron-2019');
      expect(r.status).toBe(1);
      expect(r.stdout).toContain('[identity-doubtful]');
      writeFileSync(join(dir, 'source', 'doubtful.json'), JSON.stringify({ entries: [{ ...entry, override: true }] }));
      expect(runIn('salt-and-iron-2019').status).toBe(0);
    });
  });

  it('blog:check exits 2 for an unknown slug and 2 without arguments', () => {
    expect(run('check.mjs', 'nope-2000').status).toBe(2);
    expect(spawnSync(process.execPath, [join(__dirname, '../../scripts/blog/check.mjs')], { encoding: 'utf8' }).status).toBe(2);
  });

  it('blog:brief prints the brief and exits 2 for an unknown slug', () => {
    const ok = run('brief.mjs', 'the-quiet-orchard-2023');
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('WRITER BRIEF: The Quiet Orchard (2023)');
    const bad = run('brief.mjs', 'nope-2000');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('no film with slug');
  });
});
