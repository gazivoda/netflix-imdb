import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

// Order matters: this is the order the sections render in <main>.
const SECTIONS = [
  'HomeNav', 'Hero', 'Stats', 'Marquee', 'Story', 'PromoVideo', 'BeforeAfter', 'Features',
  'HowItWorks', 'CompareCta', 'Faq', 'FinalCta', 'HomeFooter',
];

describe('home page structure', () => {
  const page = readFileSync(join(ROOT, 'app/page.tsx'), 'utf8');

  it.each(SECTIONS)('%s has a component and its own CSS module', (name) => {
    expect(existsSync(join(ROOT, `components/home/${name}.tsx`))).toBe(true);
    expect(existsSync(join(ROOT, `components/home/${name}.module.css`))).toBe(true);
  });

  it('has the shared helper module and the score chips', () => {
    expect(existsSync(join(ROOT, 'components/home/shared.module.css'))).toBe(true);
    expect(existsSync(join(ROOT, 'components/ScoreChip.tsx'))).toBe(true);
    expect(existsSync(join(ROOT, 'components/ScoreChip.module.css'))).toBe(true);
  });

  it('app/page.tsx imports and renders all 13 sections', () => {
    for (const name of SECTIONS) {
      expect(page).toContain(`from '../components/home/${name}'`);
      expect(page).toContain(`<${name} />`);
    }
  });

  it('renders the sections in document order', () => {
    const positions = SECTIONS.map((n) => page.indexOf(`<${n} />`));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('keeps #main as the skip-link target and the page module as a bare shell', () => {
    expect(page).toContain('href="#main"');
    expect(page).toContain('<main id="main"');
    const css = readFileSync(join(ROOT, 'app/page.module.css'), 'utf8');
    const selectors = css.match(/^[.#][^{]*(?=\{)/gm)?.map((s) => s.trim());
    expect(selectors).toEqual(['.page']);
  });

  it('has no testimonials section (the invented quotes were removed and nothing fake replaced them)', () => {
    expect(existsSync(join(ROOT, 'components/home/Testimonials.tsx'))).toBe(false);
    expect(page).not.toMatch(/Testimonials/);
    expect(readFileSync(join(ROOT, 'lib/content.ts'), 'utf8')).not.toMatch(/TESTIMONIALS|Loved by binge/);
  });

  it('uses no emoji in the home components', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const name of [...SECTIONS, 'shared']) {
      for (const ext of ['tsx', 'module.css']) {
        const f = join(ROOT, `components/home/${name}.${ext}`);
        if (!existsSync(f)) continue;
        const stripped = readFileSync(f, 'utf8').replace(/[★→✓]/g, '');
        expect(emoji.test(stripped)).toBe(false);
      }
    }
  });
});
