// Design guards for the "paper & ink ticket stub" design (docs/DESIGN.md).
//
// Statically scans every CSS Module + app/globals.css for patterns the design
// forbids, and every ts/tsx/css file under app/, components/ and lib/ for emoji.
// Each rule is its own test so a failure names the rule, file and line.
//
//   npx jest tests/design-guards.test.ts            # pass/fail per rule
//   DESIGN_GUARD_SUMMARY=1 npx jest tests/design-guards.test.ts   # + per rule/file counts
//
// Allow-list comments (CSS only; put on the declaration line or the line above):
//   /* ds-allow: radius */   border-radius: 50%  (status dots only)
//   /* ds-allow: white  */   a genuine white background (rare; justify it)
// Nothing else is allow-listed. Emoji have no allow comment, only the typographic
// character allow-list below.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..');
const EXCLUDED_DIRS = new Set(['node_modules', '.next', '.claude', '.git', 'tests', 'extension', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const ALL_FILES = walk(ROOT);
const rel = (f: string) => relative(ROOT, f);

const CSS_FILES = ALL_FILES.filter((f) => f.endsWith('.module.css') || rel(f) === join('app', 'globals.css'));
const EMOJI_FILES = ALL_FILES.filter((f) => {
  const r = rel(f);
  return /^(app|components|lib)\//.test(r) && /\.(tsx?|css)$/.test(r);
});

interface Violation {
  rule: string;
  file: string;
  line: number;
  text: string;
}

// ── CSS helpers ──────────────────────────────────────────────────────────────

/** Blank out comments but keep newlines, so offsets still map to line numbers. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function lineOf(text: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** Lines (1-based) carrying a `ds-allow: <kind>` comment. */
function allowLines(css: string, kind: 'radius' | 'white'): Set<number> {
  const lines = new Set<number>();
  css.split('\n').forEach((l, i) => {
    if (new RegExp(`/\\*\\s*ds-allow:\\s*${kind}\\s*\\*/`).test(l)) lines.add(i + 1);
  });
  return lines;
}

interface Decl {
  prop: string;
  value: string;
  startLine: number;
  endLine: number;
}

/** Flat declaration scan (`prop: value;`), robust to multi-line values. */
function declarations(stripped: string): Decl[] {
  const out: Decl[] = [];
  // `[^;{}]+` stops at `{`, so selectors like `a:hover {` never match.
  for (const m of stripped.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+?)\s*(?=;|\})/g)) {
    out.push({
      prop: m[1].toLowerCase(),
      value: m[2],
      startLine: lineOf(stripped, m.index!),
      endLine: lineOf(stripped, m.index! + m[0].length),
    });
  }
  return out;
}

function isAllowed(d: Decl, allowed: Set<number>): boolean {
  for (let l = d.startLine - 1; l <= d.endLine; l++) if (allowed.has(l)) return true;
  return false;
}

/** Split on commas not nested in parentheses. */
function splitTopLevel(value: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

/** Whitespace tokens at paren depth 0 (keeps `rgba(0, 0, 0, .5)` as one token). */
function topLevelTokens(layer: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of layer.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) tokens.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

const LENGTH = /^[+-]?(\d*\.?\d+)(px|rem|em)?$/;
function toPx(tok: string): number | null {
  const m = LENGTH.exec(tok);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2] === 'rem' || m[2] === 'em') return n * 16;
  return n;
}

/**
 * A shadow layer is `[inset] <x> <y> [<blur> [<spread>]] <color>` in any colour
 * position. The 3rd length is the blur radius and must be zero. Text-shadow has
 * the same shape. `var(...)` layers are only allowed for the --shadow-* tokens.
 */
function shadowLayerBlur(layer: string): { blur: number | null; bad: boolean } {
  const tokens = topLevelTokens(layer);
  if (tokens.length === 1 && tokens[0] === 'none') return { blur: 0, bad: false };
  if (tokens.length === 1 && /^var\(--shadow[\w-]*\)$/.test(tokens[0])) return { blur: 0, bad: false };
  const lengths = tokens.filter((t) => LENGTH.test(t));
  if (lengths.length >= 3) {
    const b = toPx(lengths[2]);
    return { blur: b, bad: b !== null && b !== 0 };
  }
  // Fewer than 3 lengths = blur omitted = 0. Unparseable (var() offsets etc.) is flagged
  // so nobody can smuggle a soft shadow through a variable.
  const unparsed = tokens.some((t) => t.startsWith('var(') && !/^var\(--(ink|paper|signal|gold|teal|card)\)$/.test(t));
  return { blur: null, bad: unparsed };
}

// ── CSS rules ────────────────────────────────────────────────────────────────

function scanCss(file: string, css: string): Violation[] {
  const v: Violation[] = [];
  const stripped = stripComments(css);
  const f = rel(file);
  const push = (rule: string, line: number, text: string) => v.push({ rule, file: f, line, text: text.trim() });

  // gradients / blur / backdrop-filter: any occurrence in code (not comments)
  for (const [rule, re] of [
    ['gradient', /gradient\(/g],
    ['blur', /blur\(/g],
    ['backdrop-filter', /backdrop-filter/g],
  ] as const) {
    for (const m of stripped.matchAll(re)) {
      const lineNo = lineOf(stripped, m.index!);
      push(rule, lineNo, stripped.split('\n')[lineNo - 1]);
    }
  }

  const radiusOk = allowLines(css, 'radius');
  const whiteOk = allowLines(css, 'white');

  for (const d of declarations(stripped)) {
    const where = `${d.prop}: ${d.value.replace(/\s+/g, ' ')}`;

    // Soft shadows: box-shadow, text-shadow, --shadow-* tokens, and filter drop-shadow().
    if (d.prop === 'box-shadow' || d.prop === 'text-shadow' || d.prop.startsWith('--shadow')) {
      for (const layer of splitTopLevel(d.value, ',')) {
        if (shadowLayerBlur(layer).bad) push('shadow-blur', d.startLine, where);
      }
    }
    for (const m of d.value.matchAll(/drop-shadow\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g)) {
      if (shadowLayerBlur(m[1]).bad) push('shadow-blur', d.startLine, where);
    }

    // border-radius > 2px (any corner longhand too). 50% needs the allow comment.
    if (/^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/.test(d.prop)) {
      const bad = d.value
        .split(/[\s/]+/)
        .filter(Boolean)
        .some((tok) => {
          if (tok === '0' || tok === 'inherit' || tok === 'initial' || tok === 'unset') return false;
          if (tok.startsWith('var(')) return false; // --radius is 0; no other radius token exists
          const pct = /^([\d.]+)%$/.exec(tok);
          if (pct) return parseFloat(pct[1]) > 0;
          const px = toPx(tok);
          return px !== null && px > 2;
        });
      if (bad && !isAllowed(d, radiusOk)) push('border-radius', d.startLine, where);
    }

    // White backgrounds (hex, keyword, rgb/rgba(255,255,255,*)). White TEXT is fine.
    if (d.prop === 'background' || d.prop === 'background-color' || d.prop === 'background-image') {
      const white =
        /#fff(fff)?\b/i.test(d.value) ||
        /(^|[\s,(])white\b/i.test(d.value) ||
        /rgba?\(\s*255\s*[, ]\s*255\s*[, ]\s*255\b/i.test(d.value);
      if (white && !isAllowed(d, whiteOk)) push('white-background', d.startLine, where);
    }

    // Banned typefaces in any font declaration (the design uses Archivo, Instrument Serif, JetBrains Mono).
    if (d.prop === 'font-family' || d.prop === 'font' || d.prop.startsWith('--font') || d.prop === '--display' || d.prop === '--body') {
      if (/\b(inter|roboto)\b/i.test(d.value)) push('banned-font', d.startLine, where);
    }
  }
  return v;
}

// ── Emoji rule ───────────────────────────────────────────────────────────────
//
// Anything with Unicode Extended_Pictographic is rejected, EXCEPT this allow-list
// of plain typographic marks that are not emoji. Most arrows, dashes, bullets, stars
// and check marks are not Extended_Pictographic at all and need no entry; the
// entries here are the Extended_Pictographic ones we still consider typography.
//   U+00A9 (c) U+00AE (r) U+2122 (tm)   legal marks
//   U+2194 U+2196-2199                  double and diagonal arrows (up-right link arrow)
//   U+2714                              heavy check mark, used as plain text glyph
// Always rejected regardless: U+FE0F (emoji presentation selector), U+20E3 (keycap),
// U+200D (zero-width joiner, builds emoji sequences), regional indicators U+1F1E6-1F1FF.
// The check marks/arrows only count as allowed when NOT followed by U+FE0F.

const ALLOWED_TYPOGRAPHIC = new Set([0xa9, 0xae, 0x2122, 0x2194, 0x2196, 0x2197, 0x2198, 0x2199, 0x2714]);

/** Decode `&#x1F3AC;`, `&#127916;`, `\u{1F3AC}`, `🎬` and CSS `\1F3AC` escapes so they can't hide emoji. */
function decodeEscapes(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/\\u([0-9a-f]{4})\\u([0-9a-f]{4})/gi, (m, a, b) => {
      const hi = parseInt(a, 16);
      const lo = parseInt(b, 16);
      return hi >= 0xd800 && hi < 0xdc00 && lo >= 0xdc00 && lo < 0xe000 ? String.fromCharCode(hi, lo) : m;
    })
    .replace(/\\([0-9a-f]{4,6})(?=\s|["';]|$)/gi, (m, h) => (parseInt(h, 16) >= 0x2000 ? safeChar(parseInt(h, 16)) : m));
}
function safeChar(cp: number): string {
  return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
}

const ALWAYS_BAD = /[\u{FE0F}\u{20E3}\u{200D}\u{1F1E6}-\u{1F1FF}]/u;

function scanEmoji(file: string, text: string): Violation[] {
  const v: Violation[] = [];
  const lines = decodeEscapes(text).split('\n');
  lines.forEach((line, i) => {
    const hits: string[] = [];
    for (const ch of line) {
      if (ALWAYS_BAD.test(ch)) hits.push(`U+${ch.codePointAt(0)!.toString(16).toUpperCase()}`);
      else if (/\p{Extended_Pictographic}/u.test(ch) && !ALLOWED_TYPOGRAPHIC.has(ch.codePointAt(0)!)) {
        hits.push(`${ch} U+${ch.codePointAt(0)!.toString(16).toUpperCase()}`);
      }
    }
    // An allowed glyph followed by VS16 renders as emoji; VS16 is already flagged above.
    if (hits.length) v.push({ rule: 'emoji', file: rel(file), line: i + 1, text: hits.join(', ') + '  |  ' + line.trim().slice(0, 80) });
  });
  return v;
}

// ── Run scans once ───────────────────────────────────────────────────────────

const cssViolations = CSS_FILES.flatMap((f) => scanCss(f, readFileSync(f, 'utf8')));
const emojiViolations = EMOJI_FILES.flatMap((f) => scanEmoji(f, readFileSync(f, 'utf8')));
const ALL_VIOLATIONS = [...cssViolations, ...emojiViolations];

function byRule(rule: string): Violation[] {
  return ALL_VIOLATIONS.filter((x) => x.rule === rule);
}
function expectNone(rule: string, hint: string) {
  const found = byRule(rule);
  if (found.length === 0) return;
  const perFile = new Map<string, number>();
  for (const x of found) perFile.set(x.file, (perFile.get(x.file) ?? 0) + 1);
  const summary = [...perFile].map(([file, n]) => `  ${n}x ${file}`).join('\n');
  const detail = found.map((x) => `  ${x.file}:${x.line}  ${x.text}`).join('\n');
  throw new Error(`${found.length} "${rule}" violation(s). ${hint}\n\nBy file:\n${summary}\n\nDetail:\n${detail}\n`);
}

describe('design guards: scan coverage', () => {
  it('finds the CSS Modules and globals.css', () => {
    expect(CSS_FILES.map(rel)).toContain(join('app', 'globals.css'));
    expect(CSS_FILES.length).toBeGreaterThan(5);
    expect(CSS_FILES.every((f) => !/^(tests|node_modules|\.next|\.claude)\//.test(rel(f)))).toBe(true);
  });
  it('scans ts/tsx/css under app, components and lib for emoji', () => {
    expect(EMOJI_FILES.length).toBeGreaterThan(10);
  });
});

describe('design guards: scanner self-test (fixtures)', () => {
  const run = (css: string) => scanCss(join(ROOT, 'fixture.module.css'), css).map((x) => x.rule);
  it('flags forbidden patterns', () => {
    expect(run('.a{background:linear-gradient(red,blue)}')).toContain('gradient');
    expect(run('.a{filter:blur(4px)}')).toContain('blur');
    expect(run('.a{backdrop-filter:none}')).toContain('backdrop-filter');
    expect(run('.a{box-shadow:0 10px 30px rgba(0,0,0,.4)}')).toContain('shadow-blur');
    expect(run('.a{box-shadow:6px 6px 0 var(--ink), 0 0 12px #000}')).toContain('shadow-blur');
    expect(run('.a{box-shadow:rgba(0,0,0,.5) 0 4px 8px}')).toContain('shadow-blur');
    expect(run('.a{border-radius:12px}')).toContain('border-radius');
    expect(run('.a{border-top-left-radius:.5rem}')).toContain('border-radius');
    expect(run('.a{border-radius:50%}')).toContain('border-radius');
    expect(run('.a{background:#fff}')).toContain('white-background');
    expect(run('.a{background-color:WHITE}')).toContain('white-background');
    expect(run('.a{background:rgba(255,255,255,.1)}')).toContain('white-background');
    expect(run('.a{font-family:Inter,sans-serif}')).toContain('banned-font');
    expect(run("a:hover{font-family:'Roboto'}")).toContain('banned-font');
  });
  it('accepts compliant CSS and explicit allow comments', () => {
    expect(run('.a{box-shadow:6px 6px 0 var(--ink);border-radius:2px;background:var(--card);color:#fff}')).toEqual([]);
    expect(run('.a{box-shadow:3px 3px 0 0 var(--ink),inset 0 0 0 2px var(--ink);border-radius:0}')).toEqual([]);
    expect(run('.a{box-shadow:var(--shadow-hard);box-shadow:none;border-radius:var(--radius)}')).toEqual([]);
    expect(run('/* gradient( blur( #fff */ .a{color:red}')).toEqual([]);
    expect(run('.dot{\n  /* ds-allow: radius */\n  border-radius: 50%;\n}')).toEqual([]);
    expect(run('.dot{border-radius:50%; /* ds-allow: radius */\n}')).toEqual([]);
    expect(run('.a{\n  background: #fff; /* ds-allow: white */\n}')).toEqual([]);
    expect(run('.a{font-family:var(--display)}')).toEqual([]);
  });
  it('flags emoji but allows the documented typographic marks', () => {
    const e = (s: string) => scanEmoji(join(ROOT, 'app/x.tsx'), s).length;
    expect(e('<p>\u{1F3AC} movie</p>')).toBe(1);
    expect(e('<p>⭐ star</p>')).toBe(1);
    expect(e('<p>&#x1F345; tomato</p>')).toBe(1);
    expect(e('content: "\\1F345";')).toBe(1);
    expect(e('<p>✔️</p>')).toBe(1);
    expect(e('<p>\u{1F1E9}\u{1F1EA}</p>')).toBe(1);
    expect(e('<p>© 2026 Netflix Ratings™ → ↗ — – ✓ ✔ ★ • …</p>')).toBe(0);
  });
});

describe('design guards: forbidden CSS (app/globals.css + every *.module.css)', () => {
  it('no gradients', () => expectNone('gradient', 'Use flat colour blocks (docs/DESIGN.md).'));
  it('no blur() filters', () => expectNone('blur', 'No glows or blur.'));
  it('no backdrop-filter', () => expectNone('backdrop-filter', 'No frosted glass.'));
  it('shadows are hard offsets only (blur radius 0)', () =>
    expectNone('shadow-blur', 'Use `Xpx Ypx 0 var(--ink)` or --shadow-hard / --shadow-hard-sm.'));
  it('border-radius is at most 2px (50% only for status dots with /* ds-allow: radius */)', () =>
    expectNone('border-radius', 'Square corners. Status dots: add `/* ds-allow: radius */`.'));
  it('no white backgrounds (use --card / --paper; white is text-only on signal/teal/ink)', () =>
    expectNone('white-background', 'Use var(--card) or var(--paper). Genuine exception: `/* ds-allow: white */`.'));
  it('no Inter / Roboto font names', () => expectNone('banned-font', 'Use var(--display) / var(--body) / var(--serif) / var(--mono).'));
});

describe('design guards: emoji / pictographic characters (app/, components/, lib/)', () => {
  it('contains no emoji; use <ScoreChip> or text for scores', () =>
    expectNone('emoji', 'Remove emoji. Allowed typographic marks are listed at the top of the emoji section in this test.'));
});

describe('design guards: summary', () => {
  // Opt-in: DESIGN_GUARD_SUMMARY=1 prints counts per rule and per rule/file.
  (process.env.DESIGN_GUARD_SUMMARY ? it : it.skip)('prints the violation counts', () => {
    const lines: string[] = ['', 'DESIGN GUARD SUMMARY', `total: ${ALL_VIOLATIONS.length}`];
    const rules = [...new Set(ALL_VIOLATIONS.map((x) => x.rule))].sort();
    for (const rule of rules) {
      const list = byRule(rule);
      lines.push(`\n${rule}: ${list.length}`);
      const perFile = new Map<string, number>();
      for (const x of list) perFile.set(x.file, (perFile.get(x.file) ?? 0) + 1);
      for (const [file, n] of [...perFile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) lines.push(`  ${String(n).padStart(4)}  ${file}`);
    }
    process.stdout.write(lines.join('\n') + '\n');
  });
});
