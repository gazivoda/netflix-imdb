import { slugify as selectSlugify } from '../../lib/blog/select';
import {
  MAX_TITLE_LENGTH,
  TitleError,
  articleLabel,
  displayTitle,
  generatedTitle,
  isRecognisableShortTitle,
  slugify,
} from '../../lib/blog/title';
import {
  formatAsOf,
  formatHours,
  formatImdb,
  formatSigned,
  formatVotes,
  formatVotesShort,
  isIsoDate,
} from '../../lib/blog/format';
import { clone, filmBySlug, loadFixtureFilms } from './fixtures';

const EM = '\u2014';
const EN = '\u2013';

describe('displayTitle (spec 2.3)', () => {
  it('replaces em and en dashes with " - "', () => {
    expect(displayTitle(`Rebel Moon ${EM} Part One`)).toBe('Rebel Moon - Part One');
    expect(displayTitle(`Rebel Moon${EM}Part One`)).toBe('Rebel Moon - Part One');
    expect(displayTitle(`Rebel Moon ${EN} Part One`)).toBe('Rebel Moon - Part One');
    expect(displayTitle('Rebel Moon \u2015 Part One')).toBe('Rebel Moon - Part One');
  });
  it('leaves hyphens and plain titles alone and is idempotent', () => {
    expect(displayTitle('Spider-Man: Homecoming')).toBe('Spider-Man: Homecoming');
    const once = displayTitle(`A ${EM} B`);
    expect(displayTitle(once)).toBe(once);
  });
  it('leaves no banned dash in any fixture title', () => {
    for (const f of loadFixtureFilms()) expect(displayTitle(f.omdb.title)).not.toMatch(/[\u2012-\u2015]/);
  });
});

describe('generatedTitle (R7 chain)', () => {
  const film = filmBySlug('harbor-lights-2021'); // IMDb 7.8, RT 91

  it('uses "{Film} ({Year}): IMDb x vs RT y%" first', () => {
    expect(generatedTitle(film)).toEqual({ title: 'Harbor Lights (2021): IMDb 7.8 vs RT 91%', variant: 'full' });
  });

  it('drops the year when the first form is over 50 characters', () => {
    const f = clone(film);
    f.omdb.title = 'Harbor Lights of the North'; // 26 chars: full form 53, no-year form 46
    const t = generatedTitle(f);
    expect(t.variant).toBe('no-year');
    expect(t.title).toBe('Harbor Lights of the North: IMDb 7.8 vs RT 91%');
    expect(t.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
  });

  it('falls back to shortTitle, then throws when nothing fits', () => {
    const f = clone(film);
    f.omdb.title = 'The Incredibly Long Title of a Harbor Lights Documentary';
    expect(() => generatedTitle(f)).toThrow(TitleError);
    expect(generatedTitle(f, 'Harbor Lights')).toEqual({
      title: 'Harbor Lights: IMDb 7.8 vs RT 91%',
      variant: 'short',
    });
    expect(() => generatedTitle(f, 'X'.repeat(40))).toThrow(/50/);
  });

  it('rounds IMDb to one decimal and renders a whole rating as x.0', () => {
    const f = clone(film);
    f.omdb.imdbRating = 7;
    expect(generatedTitle(f).title).toContain('IMDb 7.0 vs');
  });

  it('never contains a banned dash even when the OMDb title has one', () => {
    const f = clone(film);
    f.omdb.title = `Harbor ${EM} Lights`;
    expect(generatedTitle(f).title).toBe('Harbor - Lights (2021): IMDb 7.8 vs RT 91%');
  });

  it('every fixture title is at most 50 characters', () => {
    for (const f of loadFixtureFilms()) expect(generatedTitle(f).title.length).toBeLessThanOrEqual(50);
  });

  it('articleLabel is "{Title} ({Year})"', () => {
    expect(articleLabel(film)).toBe('Harbor Lights (2021)');
  });
});

describe('isRecognisableShortTitle', () => {
  it('accepts an ordered subset of the OMDb title words', () => {
    expect(isRecognisableShortTitle('Glass Onion', 'Glass Onion: A Knives Out Mystery')).toBe(true);
    expect(isRecognisableShortTitle('Knives Out Mystery', 'Glass Onion: A Knives Out Mystery')).toBe(true);
  });
  it('rejects invented or reordered words', () => {
    expect(isRecognisableShortTitle('Onion Glass', 'Glass Onion: A Knives Out Mystery')).toBe(false);
    expect(isRecognisableShortTitle('Glass Pear', 'Glass Onion: A Knives Out Mystery')).toBe(false);
  });
  it('rejects a single common word or stopwords only (review minor)', () => {
    expect(isRecognisableShortTitle('The', 'The Man from Toronto and Other Stories Told Twice')).toBe(false);
    expect(isRecognisableShortTitle('Man', 'The Man from Toronto and Other Stories Told Twice')).toBe(false);
    expect(isRecognisableShortTitle('Part Two', 'Rebel Moon - Part Two: The Scargiver')).toBe(false);
    expect(isRecognisableShortTitle('Mystery', 'Glass Onion: A Knives Out Mystery')).toBe(false);
  });
  it('accepts two title words, or a distinctive first word', () => {
    expect(isRecognisableShortTitle('Rebel Moon Part Two', 'Rebel Moon - Part Two: The Scargiver')).toBe(true);
    expect(isRecognisableShortTitle('Avengers', 'Avengers: Endgame and the Long Road Home Again')).toBe(true);
    expect(isRecognisableShortTitle("Harrigan's Phone", "Mr. Harrigan's Phone")).toBe(true);
  });
});

describe('slugify (spec 4.2)', () => {
  it.each([
    ["Don't Look Up", 2021, 'dont-look-up-2021'],
    ['Tom & Jerry', 2021, 'tom-and-jerry-2021'],
    ['Am\u00E9lie', 2001, 'amelie-2001'],
    ['Spider-Man: Into the Spider-Verse', 2018, 'spider-man-into-the-spider-verse-2018'],
    ['  ***Hi!!  There***  ', 2020, 'hi-there-2020'],
    [`Rebel Moon ${EM} Part One`, 2023, 'rebel-moon-part-one-2023'],
  ])('%s (%i) -> %s', (title, year, slug) => {
    expect(slugify(title, year)).toBe(slug);
  });

  it('cuts the title part at a word boundary to at most 50 chars before the year', () => {
    const s = slugify('An Extremely Long Title That Goes On And On Forever And Ever Amen', 2022);
    expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(s.endsWith('-2022')).toBe(true);
    const base = s.slice(0, -5);
    expect(base.length).toBeLessThanOrEqual(50);
    // adding "-forever" would reach 51 chars
    expect(base).toBe('an-extremely-long-title-that-goes-on-and-on');
  });

  it('is the same function T1 exports from select.ts and agrees with an independent reference', () => {
    expect(slugify).toBe(selectSlugify);
    const reference = (title: string, year: number): string => {
      const base = title
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/['\u2018\u2019]/g, '')
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .join('-');
      let cut = base;
      if (base.length > 50) {
        cut = base.slice(0, 50);
        if (base[50] !== '-' && cut.lastIndexOf('-') > 0) cut = cut.slice(0, cut.lastIndexOf('-'));
      }
      return `${cut.replace(/-+$/g, '')}-${year}`;
    };
    for (const [t, y] of [
      ["Don't Look Up", 2021],
      ['Tom & Jerry', 2021],
      ['Am\u00e9lie', 2001],
      [`Rebel Moon ${EM} Part One`, 2023],
      ['An Extremely Long Title That Goes On And On Forever And Ever Amen', 2022],
    ] as const) {
      expect(slugify(t, y)).toBe(reference(t, y));
    }
  });

  it('every fixture film slug equals slugify(title, year)', () => {
    for (const f of loadFixtureFilms()) expect(f.slug).toBe(slugify(f.omdb.title, f.omdb.year));
  });
});

describe('format helpers', () => {
  it('formats votes', () => {
    expect(formatVotes(361059)).toBe('361,059');
    expect(formatVotes(5000)).toBe('5,000');
    expect(formatVotesShort(361059)).toBe('361K');
    expect(formatVotesShort(7480)).toBe('7.5K');
    expect(formatVotesShort(7000)).toBe('7K');
    expect(formatVotesShort(1_250_000)).toBe('1.3M');
    expect(formatVotesShort(999)).toBe('999');
  });
  it('formats signed gaps with ASCII minus', () => {
    expect(formatSigned(12)).toBe('+12');
    expect(formatSigned(-27)).toBe('-27');
    expect(formatSigned(0)).toBe('0');
  });
  it('formats hours, ratings and the as-of date', () => {
    expect(formatHours(454_200_000)).toBe('454 million');
    expect(formatHours(1_530_000_000)).toBe('1.5 billion');
    expect(formatHours(850_000)).toBe('850,000');
    expect(formatImdb(6.3)).toBe('6.3');
    expect(formatAsOf('2026-10-15T09:30:00.000Z')).toBe('October 15, 2026');
    expect(formatAsOf('2026-01-05')).toBe('January 5, 2026');
    expect(() => formatAsOf('nope')).toThrow();
  });
  it('validates real calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-2-3')).toBe(false);
  });
});
