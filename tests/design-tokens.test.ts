import { readFileSync } from 'fs';
import { join } from 'path';

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

// Declarations inside the first :root block.
const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(noComments)![1];
const raw: Record<string, string> = {};
for (const m of rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) raw[m[1]] = m[2].trim();

// Resolve `var(--x)` references (tokens may alias other tokens).
function tok(name: string): string {
  let v = raw[name];
  expect(v).toBeDefined();
  for (let i = 0; i < 5 && /^var\(--[\w-]+\)$/.test(v); i++) v = raw[/var\((--[\w-]+)\)/.exec(v)![1]];
  return v;
}

function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('design tokens', () => {
  it('brand tokens have the exact spec values', () => {
    expect(tok('--paper')).toBe('#ece6d8');
    expect(tok('--ink')).toBe('#111111');
    expect(tok('--signal')).toBe('#e5241b');
    expect(tok('--gold')).toBe('#f2c230');
    expect(tok('--teal')).toBe('#2b4a5c');
    expect(tok('--card')).toBe('#f6f1e5');
  });

  it('keeps every legacy variable used by existing CSS', () => {
    for (const v of [
      '--bg', '--bg-2', '--surface', '--surface-2', '--border', '--border-strong', '--text',
      '--muted', '--faint', '--red', '--red-dark', '--red-text', '--imdb', '--rt',
      '--badge-bg', '--radius', '--display', '--body', '--serif', '--mono',
    ]) {
      expect(raw[v]).toBeDefined();
    }
  });

  it('font aliases never reference themselves (circular var bug)', () => {
    for (const [k, v] of Object.entries(raw)) {
      expect(v).not.toContain(`var(${k})`);
    }
    // The next/font-injected names must not be redeclared in :root.
    for (const v of ['--font-archivo', '--font-serif-src', '--font-mono-src']) {
      expect(Object.keys(raw)).not.toContain(v);
    }
  });

  it('uses no gradients, blur, or soft shadows in tokens/helpers', () => {
    expect(noComments).not.toMatch(/gradient\(/);
    expect(noComments).not.toMatch(/blur\(/);
    // Every box-shadow layer must be `Xpx Ypx 0 <color>` (zero blur radius).
    for (const m of noComments.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
      for (const layer of m[1].split(/,(?![^(]*\))/)) {
        expect(layer.trim()).toMatch(/^-?\d+(px)?\s+-?\d+(px)?\s+0(px)?\s+(?!\d)\S+/);
      }
    }
    for (const m of noComments.matchAll(/--shadow[\w-]*\s*:\s*([^;]+);/g)) {
      expect(m[1].trim()).toMatch(/^-?\d+px\s+-?\d+px\s+0\s/);
    }
  });

  it('defines the global helper classes and utilities', () => {
    for (const c of [
      '.ds-display', '.ds-serif', '.ds-label', '.ds-card', '.ds-btn', '.ds-btn-signal',
      '.ds-chip-imdb', '.ds-chip-rt', '.sr-only',
    ]) {
      expect(noComments).toContain(c);
    }
    expect(noComments).toMatch(/font-stretch:\s*62%/);
    expect(noComments).toMatch(/:focus-visible\s*\{[^}]*3px solid var\(--ink\)/);
    expect(noComments).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  describe('WCAG contrast', () => {
    // Every text pair clears the normal-text threshold of 4.5:1, so no pair
    // relies on the relaxed 3:1 large-text allowance.
    const pairs: Array<[string, string]> = [
      ['--ink', '--paper'],
      ['--ink', '--card'],
      ['--muted', '--paper'],
      ['--muted', '--card'],
      ['--faint', '--paper'],
      ['--faint', '--card'],
      ['--muted', '--surface-2'],
      ['--faint', '--bg-2'],
      ['--red-text', '--paper'],
      ['--red-text', '--card'],
      ['--paper', '--teal'],
      ['--ink', '--gold'],
    ];
    it.each(pairs)('%s on %s is >= 4.5:1', (fg, bg) => {
      expect(ratio(tok(fg), tok(bg))).toBeGreaterThanOrEqual(4.5);
    });

    it('white on --signal and on --red-dark is >= 4.5:1', () => {
      expect(ratio('#ffffff', tok('--signal'))).toBeGreaterThanOrEqual(4.5);
      expect(ratio('#ffffff', tok('--red-dark'))).toBeGreaterThanOrEqual(4.5);
    });
  });
});
