import fs from 'fs';
import path from 'path';

// Rating Watch no longer markets itself as open source and no longer links to its GitHub repository.
// This guard scans everything a visitor, a crawler or a store reviewer can read and fails with the
// list of offending files and lines, so the claim cannot creep back in through a copy edit.

const ROOT = path.join(__dirname, '..');

const SCAN = [
  'app',
  'components',
  'lib',
  'public',
  'extension',
  'README.md',
  'docs/blog',
  'docs/billing',
  'docs/seo/CWS-LISTING.md',
  'docs/seo/DEPLOY-CHECKLIST.md',
  'docs/seo/LAUNCH-KIT.md',
  'docs/seo/OFFSITE-ENTITY.md',
];

const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.svg', '.txt', '.xml']);
const SKIP_DIRS = new Set(['node_modules', '.next', '.cache', '.data']);
const MAX_BYTES = 2_000_000; // skips large data dumps; every prose file is far smaller

/**
 * Phrases that may stay, each pinned to one file and one exact substring of the matching line.
 * Only descriptions of OTHER products on the competitor page belong here: they say what the page
 * author could or could not check about a competitor, and make no claim about Rating Watch.
 */
const ALLOWLIST: ReadonlyArray<{ file: string; substring: string }> = [
  {
    file: 'app/compare/alternatives/page.tsx',
    substring: 'Both listings were thin on details such as source code',
  },
  {
    file: 'app/compare/alternatives/page.tsx',
    substring: 'I have not verified the source code of either or how they fetch ratings',
  },
];

const URL_RULES: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'link to the project GitHub profile or repository', re: /github\.com\/gazivoda|(?<![A-Za-z0-9_])gazivoda\/netflix-imdb/gi },
  { name: 'repository constant or schema.org codeRepository', re: /\bREPO_URL\b|\bcodeRepository\b/g },
];

const PHRASE_RULES: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'open-source claim', re: /open[\s-]+source/gi },
  { name: 'source-code claim', re: /source\s+code/gi },
];

function walk(rel: string): string[] {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [rel];
  return fs.readdirSync(full).flatMap((n) => (SKIP_DIRS.has(n) ? [] : walk(path.join(rel, n))));
}

function isScannable(rel: string): boolean {
  if (!TEXT_EXT.has(path.extname(rel))) return false;
  if (/\.min\.[a-z]+$/.test(rel)) return false; // minified bundles
  return fs.statSync(path.join(ROOT, rel)).size <= MAX_BYTES;
}

interface Hit {
  file: string;
  line: number;
  rule: string;
  text: string;
}

/** Lines are 1-based; a match spanning several lines reports its first and checks all of them. */
function findHits(rel: string, text: string, allow = ALLOWLIST): Hit[] {
  const hits: Hit[] = [];
  const lines = text.split('\n');
  const lineStarts: number[] = [];
  let offset = 0;
  for (const l of lines) {
    lineStarts.push(offset);
    offset += l.length + 1;
  }
  const lineOf = (index: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  for (const rule of [...URL_RULES.map((r) => ({ ...r, allowable: false })), ...PHRASE_RULES.map((r) => ({ ...r, allowable: true }))]) {
    for (const m of text.matchAll(rule.re)) {
      const first = lineOf(m.index!);
      const last = lineOf(m.index! + m[0].length - 1);
      const span = lines.slice(first, last + 1).join('\n');
      const start = m.index!;
      const end = start + m[0].length;
      // Allowed only when the match sits inside an allowlisted substring, so a line that carries an
      // allowlisted phrase cannot also smuggle in a second claim.
      const inside = (a: { file: string; substring: string }): boolean => {
        for (let at = text.indexOf(a.substring); at !== -1; at = text.indexOf(a.substring, at + 1)) {
          if (at <= start && end <= at + a.substring.length) return true;
        }
        return false;
      };
      const allowed = rule.allowable && allow.some((a) => a.file === rel && inside(a));
      if (!allowed) hits.push({ file: rel, line: first + 1, rule: rule.name, text: span.trim().slice(0, 160) });
    }
  }
  return hits;
}

const format = (hits: Hit[]): string =>
  hits.map((h) => `  ${h.file}:${h.line}  [${h.rule}]  ${h.text}`).join('\n');

describe('no open-source or GitHub claims', () => {
  const files = SCAN.flatMap(walk).filter(isScannable);

  it('scans a meaningful set of files', () => {
    expect(files).toEqual(expect.arrayContaining(['README.md', 'app/layout.tsx', 'lib/content.ts', 'extension/manifest.json']));
    expect(files.length).toBeGreaterThan(50);
  });

  it('finds no GitHub link, repo constant, "open source" or "source code" outside the allowlist', () => {
    const hits = files.flatMap((f) => findHits(f, fs.readFileSync(path.join(ROOT, f), 'utf8')));
    if (hits.length > 0) throw new Error(`Found ${hits.length} open-source / GitHub claim(s):\n${format(hits)}`);
  });

  it('keeps every allowlist entry live (a stale entry would silently widen the guard)', () => {
    for (const a of ALLOWLIST) {
      const text = fs.readFileSync(path.join(ROOT, a.file), 'utf8');
      expect(text).toContain(a.substring);
    }
  });

  it('keeps the allowlist to competitor descriptions on the alternatives page', () => {
    expect(ALLOWLIST.every((a) => a.file === 'app/compare/alternatives/page.tsx')).toBe(true);
  });

  describe('detector self-check', () => {
    it.each([
      ['a repo link', 'See https://github.com/gazivoda/netflix-imdb for more'],
      ['the profile link', '[me](https://github.com/gazivoda)'],
      ['a hyphenated claim', 'A free, open-source extension'],
      ['a spaced claim', 'Free and Open Source forever'],
      ['a claim split across lines', 'the extension is open\n  source and free'],
      ['source code', 'The full source code is public'],
      ['the repo constant', 'href={REPO_URL}'],
      ['codeRepository', "codeRepository: 'x'"],
    ])('flags %s', (_name, text) => {
      expect(findHits('x.tsx', text).length).toBeGreaterThan(0);
    });

    it('does not flag a local checkout path, unrelated GitHub links or normal prose', () => {
      expect(findHits('x.md', 'Run from `/Users/igorgazivoda/netflix-imdb`.')).toEqual([]);
      expect(findHits('x.md', 'See github.com/fran2889/flix-monkey and the source of truth')).toEqual([]);
    });

    it('lets an allowlisted line through only for the allowlisted file', () => {
      const allow = [{ file: 'a.tsx', substring: 'thin on details such as source code' }];
      const line = 'Both listings were thin on details such as source code.';
      expect(findHits('a.tsx', line, allow)).toEqual([]);
      expect(findHits('b.tsx', line, allow).length).toBe(1);
      expect(findHits('a.tsx', 'Our source code is public.', allow).length).toBe(1);
      // an allowlisted phrase does not shelter a second claim on the same line
      expect(findHits('a.tsx', `${line} Our source code is public.`, allow).length).toBe(1);
    });

    it('never allowlists a repository URL', () => {
      const allow = [{ file: 'a.tsx', substring: 'github.com/gazivoda' }];
      expect(findHits('a.tsx', 'https://github.com/gazivoda', allow).length).toBeGreaterThan(0);
    });
  });
});
