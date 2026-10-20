import { computeRelated, RELATED_FILL, type RelatedLink } from '../../lib/blog/related';
import { buildStats } from '../../lib/blog/stats';
import { filmBySlug, loadFixtureFilms } from './fixtures';

const films = loadFixtureFilms();
const stats = buildStats(films);
const all = films.map((f) => f.slug);
const run = (slug: string, published: string[] = all, picks?: { slug: string; reason: string }[]): RelatedLink[] =>
  computeRelated(filmBySlug(slug), { films, stats, published, picks });
const slugs = (l: RelatedLink[]) => l.map((x) => x.slug);

describe('computeRelated (spec 4.4)', () => {
  it('returns four computed links plus previous and next: six distinct film links, never the film itself', () => {
    for (const f of films) {
      const links = run(f.slug);
      expect(links).toHaveLength(6);
      expect(new Set(slugs(links)).size).toBe(6);
      expect(slugs(links)).not.toContain(f.slug);
      expect(links.slice(0, 4).every((l) => !['previous', 'next'].includes(l.kind))).toBe(true);
      expect(links[4].kind).toBe('previous');
      expect(links[5].kind).toBe('next');
    }
  });

  it('(a) two same-genre films with the nearest gap, (b) opposite sign in genre, (c) shared people', () => {
    const links = run('harbor-lights-2021'); // Drama, +13
    expect(links.map((l) => [l.slug, l.kind])).toEqual([
      ['the-quiet-orchard-2023', 'nearest-gap'], // Drama +1, distance 12
      ['tin-soldier-blues-2018', 'nearest-gap'], // Drama 0, distance 13
      ['glass-harvest-2022', 'opposite'], // Drama -22
      ['midnight-ferry-2025', 'shared-people'], // shares lead Ines Calder
      ['sundown-express-2024', 'previous'], // rank 1 wraps to rank 12
      ['crimson-static-2022', 'next'],
    ]);
  });

  it('for agreed films (b) is the largest abs gap in the genre', () => {
    const links = run('the-quiet-orchard-2023'); // agreed-high, Drama
    expect(links.find((l) => l.kind === 'opposite')?.slug).toBe('glass-harvest-2022');
  });

  it('(b) falls back to the whole set when the genre has nothing left of the opposite sign', () => {
    // Sci-Fi has only neon-meridian besides velvet-orbit, and step (a) already used it
    const velvet = run('velvet-orbit-2023'); // -33
    expect(velvet[0]).toEqual({ slug: 'neon-meridian-2024', kind: 'nearest-gap' });
    expect(velvet.find((l) => l.kind === 'opposite')?.slug).toBe('echo-valley-2021'); // widest positive left (+16)
    const echo = run('echo-valley-2021'); // Comedy +16; paper-lanterns is the only other Comedy and is taken by (a)
    expect(echo.find((l) => l.kind === 'opposite')?.slug).toBe('velvet-orbit-2023'); // widest negative (-33)
  });

  it('writer picks come first, max 2, and invalid picks are ignored', () => {
    const links = run('harbor-lights-2021', all, [
      { slug: 'velvet-orbit-2023', reason: 'shared tone' },
      { slug: 'harbor-lights-2021', reason: 'self' },
      { slug: 'not-a-film-2000', reason: 'unknown' },
      { slug: 'paper-lanterns-2020', reason: 'second' },
      { slug: 'echo-valley-2021', reason: 'third, dropped' },
    ]);
    expect(links).toHaveLength(6);
    expect(links.slice(0, 2).map((l) => [l.slug, l.kind, l.reason])).toEqual([
      ['velvet-orbit-2023', 'pick', 'shared tone'],
      ['paper-lanterns-2020', 'pick', 'second'],
    ]);
    expect(slugs(links)).not.toContain('echo-valley-2021');
    expect(links.filter((l) => !['pick', 'previous', 'next'].includes(l.kind))).toHaveLength(RELATED_FILL - 2);
  });

  it('only links to published films', () => {
    const published = ['harbor-lights-2021', 'crimson-static-2022', 'the-quiet-orchard-2023', 'salt-and-iron-2019'];
    for (const slug of published) {
      const links = run(slug, published);
      for (const l of links) expect(published).toContain(l.slug);
      expect(slugs(links)).not.toContain(slug);
      expect(links.length).toBe(3); // only three other published films exist
    }
  });

  it('an unpublished film still gets previews built from the published ring', () => {
    const links = run('velvet-orbit-2023', ['harbor-lights-2021', 'crimson-static-2022', 'salt-and-iron-2019']);
    expect(links.length).toBeGreaterThan(0);
    expect(slugs(links)).not.toContain('velvet-orbit-2023');
  });

  it('every published article receives at least two inbound article links (needs three or more published)', () => {
    const published = ['harbor-lights-2021', 'crimson-static-2022', 'the-quiet-orchard-2023', 'salt-and-iron-2019'];
    const inbound = new Map(published.map((s) => [s, 0]));
    for (const s of published) for (const l of run(s, published)) inbound.set(l.slug, (inbound.get(l.slug) ?? 0) + 1);
    for (const [slug, n] of inbound) expect({ slug, ok: n >= 2 }).toEqual({ slug, ok: true });
  });

  it('is deterministic', () => {
    expect(run('harbor-lights-2021')).toEqual(run('harbor-lights-2021'));
  });

  it('returns nothing when nothing else is published', () => {
    expect(run('harbor-lights-2021', ['harbor-lights-2021'])).toEqual([]);
    expect(run('harbor-lights-2021', [])).toEqual([]);
  });
});
