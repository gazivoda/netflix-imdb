import { join } from 'path';
import {
  ARCHETYPE_LABEL,
  dataSources,
  factRows,
  relatedItems,
  renderArticle,
  scoreRows,
  scoresAsOfLine,
  sectionOrder,
} from '../../app/blog/_lib/article-view';
import { cardText, gapMarkerPercent, titleSizeFor } from '../../app/blog/_lib/og-text';
import { buildStats, ordinal } from '../../lib/blog/stats';
import { clone, loadFixtureArticles, loadFixtureFilmsFile } from './fixtures';

const file = loadFixtureFilmsFile();
const films = file.films;
const stats = buildStats(films);
const articles = loadFixtureArticles();
const article = articles.find((a) => a.slug === 'harbor-lights-2021')!;
const film = films.find((f) => f.slug === 'harbor-lights-2021')!;
const crimson = films.find((f) => f.slug === 'crimson-static-2022')!;

describe('scoreRows', () => {
  it('shows exactly the films.json values', () => {
    const rows = scoreRows(film, stats[film.slug]);
    const by = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(by['IMDb rating']).toBe('7.8');
    expect(by['IMDb votes']).toBe('184,200');
    expect(by['Rotten Tomatoes']).toBe('91%');
    expect(by['Metascore']).toBe('86');
    expect(by['IMDb x 10']).toBe('78');
    expect(by['Gap']).toBe('+13');
    expect(by['Gap rank']).toBe(`${ordinal(stats[film.slug].gapRank)} of 12`);
    expect(by['Reading']).toBe(ARCHETYPE_LABEL['critics-higher']);
  });

  it('omits the Metascore row when OMDb has none and uses a signed negative gap', () => {
    const f = clone(crimson);
    f.omdb.metascore = null;
    const rows = scoreRows(f, stats[f.slug]);
    expect(rows.some((r) => r.label === 'Metascore')).toBe(false);
    expect(rows.find((r) => r.label === 'Gap')!.value).toBe('-26');
  });

  it('has no forbidden glyphs in any generated text', () => {
    const text = JSON.stringify(films.flatMap((f) => scoreRows(f, stats[f.slug])));
    expect(text).not.toMatch(/[–—→·]|\p{Extended_Pictographic}/u);
  });
});

describe('factRows', () => {
  const published = new Set(['crimson-static-2022']);
  const rows = factRows(film, stats[film.slug], { films, stats, published });
  it('is a definition list of short facts including Netflix chart facts', () => {
    const terms = rows.map((r) => r.term);
    expect(terms).toEqual(expect.arrayContaining(['Netflix popularity rank', 'Weeks in the Netflix Top 10', 'Peak Netflix Top 10 rank', 'Hours viewed']));
    expect(rows.find((r) => r.term === 'Hours viewed')!.parts[0].text).toBe('310 million hours, summed over its weeks in the global Top 10');
    expect(rows.find((r) => r.term === 'Weeks in the Netflix Top 10')!.parts[0].text).toBe('9');
  });
  it('links neighbours only when they are published', () => {
    const near = rows.find((r) => r.term === 'Closest gaps in the set')!;
    for (const p of near.parts.filter((x) => x.href)) expect(p.href).toBe('/blog/crimson-static-2022');
    const none = factRows(film, stats[film.slug], { films, stats, published: new Set() }).find((r) => r.term === 'Closest gaps in the set')!;
    expect(none.parts.every((p) => !p.href)).toBe(true);
  });
  it('omits peak rank when Netflix has none and labels first-91-days hours', () => {
    const f = clone(film);
    f.netflix.peakRank = null;
    f.netflix.hoursSource = 'first-91-days';
    const r = factRows(f, stats[f.slug], { films, stats, published });
    expect(r.some((x) => x.term === 'Peak Netflix Top 10 rank')).toBe(false);
    expect(r.find((x) => x.term === 'Hours viewed')!.parts[0].text).toContain('first 91 days');
  });
});

describe('sectionOrder / renderArticle', () => {
  it('opens split archetypes with why-split and agreed ones with who-it-suits', () => {
    expect(sectionOrder('critics-higher')[0]).toBe('why-split');
    expect(sectionOrder('audience-higher')[0]).toBe('why-split');
    for (const a of ['agreed-high', 'agreed-low', 'agreed-mixed'] as const) expect(sectionOrder(a)[0]).toBe('who-it-suits');
  });

  it('renders every token of every published-style fixture article', () => {
    for (const a of articles) {
      const f = films.find((x) => x.slug === a.slug)!;
      const v = renderArticle(a, f, stats[f.slug]);
      expect(JSON.stringify(v)).not.toMatch(/\{\{|\}\}/);
      expect(v.sections.map((s) => s.id)).toEqual(expect.arrayContaining(['why-split', 'the-film', 'who-it-suits']));
    }
  });

  it('puts sections in archetype order and the data note aside', () => {
    const a = clone(article);
    a.sections.push({ id: 'data-note', heading: 'A note on the data?', paragraphs: ['Checked on the site.'] });
    const v = renderArticle(a, film, stats[film.slug]);
    expect(v.sections.map((s) => s.id)).toEqual(['why-split', 'the-film', 'who-it-suits']);
    expect(v.dataNote?.heading).toBe('A note on the data?');

    const agreed = articles.find((x) => stats[x.slug].archetype.startsWith('agreed'))!;
    const af = films.find((x) => x.slug === agreed.slug)!;
    expect(renderArticle(agreed, af, stats[af.slug]).sections[0].id).toBe('who-it-suits');
  });

  it('injects the film numbers (summary carries the rendered scores)', () => {
    const v = renderArticle(article, film, stats[film.slug]);
    expect(v.summary).toContain('7.8');
    expect(v.summary).toContain('91%');
  });

  it('throws on an unknown token (a build error, never a silent blank)', () => {
    const a = clone(article);
    a.summary = 'Broken {{nope}} token.';
    expect(() => renderArticle(a, film, stats[film.slug])).toThrow(/unknown token/);
  });
});

describe('dataSources / scoresAsOfLine', () => {
  it('lists OMDb, IMDb and Netflix, and the Rotten Tomatoes page only after a hand check', () => {
    const base = dataSources(film, article, file);
    expect(base.map((s) => s.publisher)).toEqual(['OMDb', 'IMDb', 'Netflix']);
    expect(base[1].url).toBe(`https://www.imdb.com/title/${film.omdb.imdbId}/`);

    const a = clone(article);
    a.review.rtCheck = { checkedOn: '2026-10-18', url: 'https://www.rottentomatoes.com/m/x', rtSitePercent: 90, rtSiteReviews: 120, outcome: 'match' };
    expect(dataSources(film, a, file).map((s) => s.publisher)).toContain('Rotten Tomatoes');
    a.review.rtCheck.outcome = 'hold';
    expect(dataSources(film, a, file).map((s) => s.publisher)).not.toContain('Rotten Tomatoes');
  });

  it('states the fetch date and the Netflix data window', () => {
    expect(scoresAsOfLine(film, file)).toBe(
      "Scores as of October 15, 2026, via OMDb. Popularity from Netflix's Top 10 data (July 4, 2021 to October 4, 2026).",
    );
  });
});

describe('relatedItems', () => {
  it('links only published films and never the film itself', () => {
    const published = ['crimson-static-2022', 'the-quiet-orchard-2023', 'harbor-lights-2021'];
    const items = relatedItems(article, film, { films, stats, published });
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(published).toContain(i.slug);
      expect(i.slug).not.toBe(film.slug);
      expect(i.label).toMatch(/\(\d{4}\)$/);
    }
  });
  it('is empty when nothing else is published', () => {
    expect(relatedItems(article, film, { films, stats, published: ['harbor-lights-2021'] })).toEqual([]);
  });
});

describe('og text', () => {
  it('builds the card text from film data', () => {
    const t = cardText(crimson, stats[crimson.slug]);
    expect(t).toMatchObject({ title: 'Crimson Static', year: '2022', imdb: '6.4', rt: '38%', gap: '-26' });
    expect(t.verdict).toBe('Audiences scored higher by 26 points');
    expect(t.asOf).toBe('Scores as of October 15, 2026, via OMDb');
    expect(t.alt).toBe('Crimson Static (2022): IMDb 6.4 vs Rotten Tomatoes 38%');
  });
  it('words agreement without picking a side', () => {
    const f = films.find((x) => stats[x.slug].archetype.startsWith('agreed'))!;
    expect(cardText(f, stats[f.slug]).verdict).toMatch(/^The two scores are \d+ points? apart$|^The two scores are equal$/);
  });
  it('cleans dashes out of the title and shrinks long titles', () => {
    const f = clone(film);
    f.omdb.title = 'Harbor — Lights';
    expect(cardText(f, stats[film.slug]).title).toBe('Harbor - Lights');
    expect(titleSizeFor('Short')).toBeGreaterThan(titleSizeFor('A considerably longer film title here'));
    expect(titleSizeFor('x'.repeat(80))).toBe(50);
  });
  it('keeps the gap marker on the bar', () => {
    expect(gapMarkerPercent(0)).toBe(50);
    expect(gapMarkerPercent(-90)).toBe(4);
    expect(gapMarkerPercent(90)).toBe(96);
    expect(gapMarkerPercent(-26)).toBeLessThan(50);
  });
});
