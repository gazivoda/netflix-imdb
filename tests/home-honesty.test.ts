import { readFileSync } from 'fs';
import { join } from 'path';
import * as content from '../lib/content';
import { PAGES } from '../lib/pages';

const ROOT = join(__dirname, '..');
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');

describe('rating-source claims stay true (OMDb has no Rotten Tomatoes score for TV series)', () => {
  const claim = /(Rotten Tomatoes|Tomatometer)[^.]{0,60}\bevery (Netflix )?(title )?card|every (Netflix )?title card[^.]{0,80}(Rotten Tomatoes|Tomatometer)/i;

  it('no home copy promises Rotten Tomatoes on every card', () => {
    const texts = [
      ...content.FAQS.map((f) => f.a),
      ...content.FEATURES.map((f) => f.desc),
      ...content.STATS.map((s) => `${s.label} ${s.sub}`),
      ...['Hero', 'Story', 'HowItWorks', 'FinalCta'].map((n) => read(`components/home/${n}.tsx`)),
      ...PAGES.map((p) => p.description),
    ];
    for (const t of texts) expect(t).not.toMatch(claim);
  });

  it('the FAQ says that series usually show IMDb only', () => {
    const a = content.FAQS.find((f) => f.q === 'Does it show ratings for every title?')!.a;
    expect(a).toMatch(/series/i);
    expect(a).toMatch(/IMDb only/);
  });

  it('shows no Rotten Tomatoes score on any TV series in the home mock-ups', () => {
    const series = ['Stranger Things', 'Squid Game', 'The Crown', 'Ozark', 'Wednesday', 'The Witcher', 'Bridgerton', 'Narcos'];
    for (const t of series) {
      const s = content.SHOWCASE[t];
      if (s) expect(s.rt).toBeUndefined();
    }
    for (const m of content.MARQUEE) expect(content.SHOWCASE[m.title]).toEqual({ imdb: m.imdb, ...(m.rt ? { rt: m.rt } : {}) });
  });
});

describe('API-key claims stay true (shared daily allowance, optional personal key)', () => {
  it('never says there is "no key to enter"', () => {
    for (const f of ['app/install/page.tsx', 'lib/content.ts', 'lib/llms.ts', 'lib/pages.ts']) {
      expect(read(f)).not.toMatch(/no key to enter|no API key to enter/i);
    }
  });

  it('the install FAQ and the home FAQ mention the shared allowance and the personal key', () => {
    const install = read('app/install/page.tsx');
    expect(install).toMatch(/shared OMDb lookup allowance/);
    expect(install).toMatch(/personal OMDb key/);
    const home = content.FAQS.find((f) => f.q === 'Do I need an API key?')!.a;
    expect(home).toMatch(/shared/);
    expect(home).toMatch(/personal OMDb key/);
  });
});

describe('install wording is honest about the manual add', () => {
  it('says download, never implies a Chrome Web Store listing', () => {
    expect(read('components/home/Hero.tsx')).toMatch(/Download free/);
    expect(read('components/home/FinalCta.tsx')).toMatch(/not in the Chrome Web Store yet/);
    for (const f of ['components/home/Hero.tsx', 'components/home/FinalCta.tsx', 'lib/content.ts']) {
      expect(read(f)).not.toMatch(/Add to Chrome|available on the Chrome Web Store/);
    }
  });
});

describe('legal identity constants render only when set', () => {
  it('ships LEGAL_ENTITY, LEGAL_ADDRESS and GOVERNING_LAW as empty strings until the owner fills them in', () => {
    expect(typeof content.LEGAL_ENTITY).toBe('string');
    expect(typeof content.LEGAL_ADDRESS).toBe('string');
    expect(typeof content.GOVERNING_LAW).toBe('string');
  });

  it('privacy and terms gate each block on its constant', () => {
    const privacy = read('app/privacy/page.tsx');
    expect(privacy).toMatch(/LEGAL_ENTITY \? ` Operated by \$\{LEGAL_ENTITY\}\.`/);
    expect(privacy).toMatch(/LEGAL_ADDRESS \? ` Address: \$\{LEGAL_ADDRESS\}\.`/);
    const terms = read('app/terms/page.tsx');
    expect(terms).toMatch(/GOVERNING_LAW \? \(/);
    expect(terms).toMatch(/LEGAL_ENTITY \? ` Operated by/);
  });

  it('terms keep statutory rights and name Paddle as the seller of record', () => {
    const terms = read('app/terms/page.tsx');
    expect(terms).toMatch(/Nothing in these terms limits or excludes your statutory\s+rights/);
    expect(terms).toMatch(/Paddle is the merchant of record and the seller/);
  });
});

describe('privacy page covers the required content', () => {
  const src = read('app/privacy/page.tsx');
  it.each([
    ['legal bases', /legal bases/i],
    ['consent as the analytics basis', /<strong>Consent<\/strong>/],
    ['contract', /<strong>Contract<\/strong>/],
    ['legitimate interests', /Legitimate interests/],
    ['international transfers', /International transfers/],
    ['supervisory authority complaint', /supervisory authority/],
    ['Paddle as an independent controller', /independent controller/],
    ['Paddle.js loading', /Paddle\.js/],
    ['the jsDelivr OCR load', /cdn\.jsdelivr\.net/],
    ['IP address seen by OMDb', /IP\s+address and your browser/],
    ['retention section', /How long we keep data/],
  ])('mentions %s', (_n, re) => {
    expect(src).toMatch(re);
  });

  it('no longer calls Google or Paddle a processor', () => {
    expect(src).not.toMatch(/processor or independent provider/);
  });
});
