import { lintCopy, lintDisplayTitle, allStrings } from '../../lib/blog/lint';
import { BANNED_PHRASES, detectDirections, matchesArchetype } from '../../lib/blog/wording';
import { buildStats, type FilmStats } from '../../lib/blog/stats';
import type { Article } from '../../lib/blog/types';
import { clone, filmBySlug, loadFixtureArticles, loadFixtureFilms } from './fixtures';

const films = loadFixtureFilms();
const stats = buildStats(films);
const articles = loadFixtureArticles();
const get = (slug: string): Article => articles.find((a) => a.slug === slug)!;

const lint = (a: Article, statsOverride?: FilmStats) =>
  lintCopy(a, { film: films.find((f) => f.slug === a.slug)!, stats: statsOverride ?? stats[a.slug] });
const rules = (a: Article, s?: FilmStats) => lint(a, s).map((i) => i.rule);

/** Append a sentence to the first paragraph of the-film (neutral place for injected text). */
const withText = (slug: string, text: string): Article => {
  const a = clone(get(slug));
  const sec = a.sections.find((s) => s.id === 'the-film')!;
  sec.paragraphs[0] += ` ${text}`;
  return a;
};

describe('good fixtures', () => {
  it.each(articles.map((a) => [a.slug, a] as const))('%s has no lint findings', (_s, a) => {
    expect(lint(a)).toEqual([]);
  });
  it('allStrings walks every string with a path', () => {
    const strings = allStrings(get('harbor-lights-2021'));
    expect(strings.find((s) => s.where === 'summary')).toBeDefined();
    expect(strings.find((s) => s.where === 'sections[0].paragraphs[1]')).toBeDefined();
    expect(strings.find((s) => s.where === 'sources[0].url')).toBeDefined();
  });
});

describe('forbidden characters (every string in the JSON)', () => {
  const cases: [string, string][] = [
    ['emoji', 'A film night \u{1F3AC} out.'],
    ['em dash', 'A film \u2014 out.'],
    ['en dash', 'A film \u2013 out.'],
    ['horizontal bar', 'A film \u2015 out.'],
    ['arrow', 'A film \u2192 out.'],
    ['long arrow', 'A film \u27F6 out.'],
    ['supplemental arrow', 'A film \u2905 out.'],
    ['block arrow', 'A film \u2B95 out.'],
    ['bullet', 'A film \u2022 out.'],
    ['middle dot', 'A film \u00B7 out.'],
    ['ascii arrow ->', 'A film -> out.'],
    ['ascii arrow =>', 'A film => out.'],
    ['ascii arrow <-', 'A film <- out.'],
    ['hex colour', 'A film in #ff00aa out.'],
    ['short hex colour', 'A film in #abc out.'],
    ['zero width space', 'A film\u200B out.'],
  ];
  it.each(cases)('flags %s in prose', (_name, text) => {
    expect(rules(withText('harbor-lights-2021', text))).toContain('forbidden-char');
  });
  it('flags a banned character in a non-prose field (source title, review cut)', () => {
    const a = clone(get('harbor-lights-2021'));
    a.sources[0].title = 'Top 10 \u2014 Netflix';
    expect(rules(a)).toContain('forbidden-char');
    const b = clone(get('harbor-lights-2021'));
    b.review.cuts = ['removed: a \u2192 b'];
    expect(rules(b)).toContain('forbidden-char');
  });
  it('allows # in a URL fragment and plain hyphens', () => {
    const a = clone(get('harbor-lights-2021'));
    a.sources[0].url = 'https://www.netflix.com/tudum/top10#fed1ab';
    expect(rules(a)).not.toContain('forbidden-char');
  });
});

describe('banned phrases (7.3)', () => {
  it.each(BANNED_PHRASES.map((p) => p.label))('flags "%s"', (label) => {
    const sample: Record<string, string> = {
      delve: 'Let us delve into it.',
      'rollercoaster': 'It is a rollercoaster.',
      boasts: 'It boasts a cast.',
      elevate: 'Scenes elevate it.',
      showcase: 'It will showcase talent.',
      navigate: 'Viewers navigate the plot.',
      landscape: 'The landscape is crowded.',
      tapestry: 'A rich tapestry.',
    };
    const text = sample[label] ?? `Some words ${label} more words.`;
    expect(rules(withText('harbor-lights-2021', text))).toContain('banned-phrase');
  });
  it('treats the curly apostrophe like the straight one', () => {
    expect(rules(withText('harbor-lights-2021', 'It\u2019s important to note this.'))).toContain('banned-phrase');
  });
  it('does not flag look-alike words', () => {
    expect(rules(withText('harbor-lights-2021', 'The boat sailed past a boastful sailor and a delicate plan.'))).not.toContain('banned-phrase');
  });
});

describe('always forbidden words and claims', () => {
  it.each([
    'polarising', 'polarizing', 'overrated', 'underrated', 'masterpiece', 'a must-watch', 'a flop', 'critics hated it',
    'audiences hated it', 'the best scene', 'the worst scene',
  ])('flags "%s"', (w) => {
    expect(rules(withText('harbor-lights-2021', `It is ${w} here.`))).toContain('forbidden-word');
  });
  it.each([
    'a Netflix Original', 'available on Netflix', 'streaming now', 'it is on Netflix now', 'an official score', 'partnered with them',
    'The box office was good', 'The budget was small', 'I loved it',
  ])('flags claim "%s"', (w) => {
    expect(rules(withText('harbor-lights-2021', `It is ${w} here.`))).toContain('forbidden-claim');
  });
  it('allows we for method but not for viewing', () => {
    expect(rules(withText('harbor-lights-2021', 'We compare the two scores.'))).not.toContain('forbidden-claim');
    expect(rules(withText('harbor-lights-2021', 'We watched it twice.'))).toContain('forbidden-claim');
  });
});

describe('tier words (3.4)', () => {
  const tierCases: [string, string[], string[]][] = [
    // slug, forbidden samples, allowed samples
    // cumulative (I2): a tier never borrows the vocabulary of any higher tier
    ['harbor-lights-2021', ['A huge difference.', 'A massive difference.', 'An enormous difference.', 'A chasm opens.', 'A very wide difference.', 'One of the widest.', 'This is a wide and large difference, and critics rate it sharply higher.', 'A big difference.', 'The scores split.'], ['A clear gap, noticeably higher, so they disagree.']],
    ['crimson-static-2022', ['A very wide difference.', 'The widest here.', 'It is a huge, massive difference.', 'An enormous chasm.'], ['A wide gap and a large gap, sharply.']],
    ['the-quiet-orchard-2023', ['A gap.', 'The scores split.', 'They divide.', 'They disagree.', 'A wide difference.', 'A large difference.', 'A big difference.', 'A sharp difference.', 'A huge difference.', 'Critics are slightly higher.', 'Critics are noticeably warmer.', 'Critics rate it far higher.', 'Viewers liked it far more.', 'A clear gap.', 'Critics are much higher here.', 'Critics sit well above viewers.', 'A significantly different score.'], ['They closely agree, within a few points.']],
    ['salt-and-iron-2019', ['A wide difference.', 'A large difference.', 'A big difference.', 'A sharp difference.', 'The scores split.', 'A huge difference.', 'There is a clear gap here.', 'The two sides disagree.', 'Viewers are noticeably warmer.'], ['A small gap, slightly higher, mostly agree.']],
  ];
  for (const [slug, bad, ok] of tierCases) {
    it.each(bad)(`${slug}: flags "%s"`, (text) => {
      expect(rules(withText(slug, text))).toContain('tier-word');
    });
    it(`${slug}: allows its own tier wording`, () => {
      expect(rules(withText(slug, ok[0]))).not.toContain('tier-word');
    });
  }

  it.each([
    ['It had a wide release before reaching streaming, and it was shot for the big screen.'],
    ['The story turns on a generation gap within one family.'],
    ['A big-screen release with an age gap romance.'],
  ])('agree tier: fixed phrases are not tier words: %s', (text) => {
    expect(rules(withText('the-quiet-orchard-2023', text))).not.toContain('tier-word');
  });

  it('clear tier: "{{gapRank}} largest" is a computed rank, not a size word', () => {
    expect(rules(withText('harbor-lights-2021', 'That is the {{gapRank}} largest difference here.'))).not.toContain('tier-word');
    expect(rules(withText('harbor-lights-2021', 'That is a large difference.'))).toContain('tier-word');
  });

  it('ignores token names that look like banned words', () => {
    expect(rules(withText('the-quiet-orchard-2023', 'The number is {{gap}} and {{gapAbs}}.'))).not.toContain('tier-word');
  });

  it('very wide tier: widest only when gapRank is 10 or better', () => {
    const base = withText('crimson-static-2022', 'It is one of the widest in this set.');
    const veryWide = { ...stats['crimson-static-2022'], tier: 'very-wide' as const, absGap: 33 };
    expect(rules(base, { ...veryWide, gapRank: 4 })).not.toContain('tier-word');
    expect(rules(base, { ...veryWide, gapRank: 11 })).toContain('tier-word');
    expect(rules(withText('crimson-static-2022', 'It is a very wide gap.'), { ...veryWide, gapRank: 11 })).not.toContain('tier-word');
  });
});

describe('score-like literals (R11)', () => {
  it.each(['The IMDb score is 6.3 now.', 'It shows 36% today.', 'A gap of 12 points exists.', 'Only 1 point apart.', 'It got 91 % here.', 'About 3 points up.'])(
    'flags "%s"',
    (text) => {
      expect(rules(withText('harbor-lights-2021', text))).toContain('score-literal');
    },
  );
  it('allows tokens, years, ratings and counts in words', () => {
    const ok = 'Released in 2021, rated PG-13, with two nominations and {{imdb}} on IMDb, {{rt}} on RT, {{gapAbs}} points apart.';
    expect(rules(withText('harbor-lights-2021', ok))).not.toContain('score-literal');
  });
  it('also checks headings, h1 and the faq', () => {
    const a = clone(get('harbor-lights-2021'));
    a.h1 = 'Why 91% of critics rate Harbor Lights above its audience score';
    expect(rules(a)).toContain('score-literal');
    const b = clone(get('harbor-lights-2021'));
    b.faq[0].a += ' It scored 7.8 overall.';
    expect(rules(b)).toContain('score-literal');
  });
});

describe('plot overlap (6 words)', () => {
  const plot = filmBySlug('harbor-lights-2021').omdb.plot!;
  it('fixture plot is what the test expects', () => {
    expect(plot).toContain('invented plot about a lighthouse keeper who finds a map');
  });
  it('flags a six-word run copied from omdb.plot', () => {
    expect(rules(withText('harbor-lights-2021', 'It is an invented plot about a lighthouse keeper.'))).toContain('plot-overlap');
  });
  it('ignores case and punctuation when matching', () => {
    expect(rules(withText('harbor-lights-2021', 'INVENTED PLOT, about: a lighthouse keeper!'))).toContain('plot-overlap');
  });
  it('allows a five-word run', () => {
    expect(rules(withText('harbor-lights-2021', 'It has a plot about a lighthouse keeper.'))).not.toContain('plot-overlap');
  });
  it('a missing plot never flags', () => {
    const a = withText('harbor-lights-2021', 'It is an invented plot about a lighthouse keeper.');
    const film = clone(filmBySlug('harbor-lights-2021'));
    film.omdb.plot = null;
    expect(lintCopy(a, { film, stats: stats[a.slug] }).map((i) => i.rule)).not.toContain('plot-overlap');
  });
});

describe('markup, cannibalisation and section content rules', () => {
  it.each(['<b>bold</b>', '**bold**', 'a `code` bit', '__bold__', '![img](/x.png)'])('flags markup "%s"', (text) => {
    expect(rules(withText('harbor-lights-2021', text))).toContain('markup');
  });
  it('flags a heading-style or list-style line', () => {
    const a = clone(get('harbor-lights-2021'));
    a.sections[1].paragraphs[1] = '# Heading\n- item';
    expect(rules(a)).toContain('markup');
  });
  it('keeps markdown links legal', () => {
    expect(rules(withText('harbor-lights-2021', 'See [the guide](/install) too.'))).not.toContain('markup');
  });
  it('flags an h1 that targets the bare comparison phrase without the film', () => {
    const a = clone(get('harbor-lights-2021'));
    a.h1 = 'IMDb vs Rotten Tomatoes: which score should you trust more?';
    expect(rules(a)).toContain('cannibalise');
    a.h1 = 'IMDb vs Rotten Tomatoes for Harbor Lights, explained for you';
    expect(rules(a)).not.toContain('cannibalise');
  });
  it('why-split with one evidence field fails', () => {
    const a = clone(get('harbor-lights-2021'));
    a.sections.find((s) => s.id === 'why-split')!.paragraphs = ['Critics rate it higher than audiences, by {{gapAbs}} points. Metascore is {{metascore}}.'];
    expect(lint(a).filter((i) => i.rule === 'why-split').map((i) => i.message).join('|')).toMatch(/at least two/);
  });
  it('why-split without a gap size token fails', () => {
    const a = clone(get('harbor-lights-2021'));
    a.sections.find((s) => s.id === 'why-split')!.paragraphs = ['Critics rate it higher than audiences. Metascore {{metascore}} and {{votes}} votes back that.'];
    expect(lint(a).filter((i) => i.rule === 'why-split').map((i) => i.message).join('|')).toMatch(/gap size/);
  });
  it('why-split with the wrong direction fails', () => {
    const a = clone(get('harbor-lights-2021'));
    a.sections.find((s) => s.id === 'why-split')!.paragraphs = ['Audiences rate it higher than critics, by {{gapAbs}} points. Metascore {{metascore}} and {{votes}} votes back that.'];
    expect(lint(a).filter((i) => i.rule === 'why-split').map((i) => i.message).join('|')).toMatch(/direction/);
  });
  it('who-it-suits needs a conditional position', () => {
    const a = clone(get('harbor-lights-2021'));
    a.sections.find((s) => s.id === 'who-it-suits')!.paragraphs = ['This film is a drama of a certain kind and it has a running time that is typical for the genre, with no other remark made here at all.'];
    expect(rules(a)).toContain('who-it-suits');
  });
});

describe('direction detection', () => {
  it.each([
    ['Critics rate it higher than audiences.', ['critics-higher']],
    ['Audiences rate it sharply higher than critics.', ['audience-higher']],
    ['IMDb sits below Rotten Tomatoes here.', ['critics-higher']],
    ['Rotten Tomatoes sits below IMDb here.', ['audience-higher']],
    ['The critic side is lower than the audience side.', ['audience-higher']],
    ['Nothing comparative here.', []],
  ])('%s', (text, expected) => {
    expect(detectDirections(text)).toEqual(expected);
  });
  it('agreed archetypes need an agreement word', () => {
    expect(matchesArchetype('They mostly agree.', 'agreed-mixed')).toBe(true);
    expect(matchesArchetype('Critics rate it higher than audiences.', 'agreed-mixed')).toBe(false);
    expect(matchesArchetype('They disagree.', 'agreed-high')).toBe(false);
  });
});

describe('rendered display titles', () => {
  it('passes for the fixtures', () => {
    for (const f of films) expect(lintDisplayTitle(f)).toEqual([]);
  });
  it('dashes are replaced so a raw OMDb title with an em dash passes', () => {
    const f = clone(filmBySlug('harbor-lights-2021'));
    f.omdb.title = 'Harbor \u2014 Lights';
    expect(lintDisplayTitle(f)).toEqual([]);
  });
  it('flags other banned glyphs that displayTitle does not remove', () => {
    const f = clone(filmBySlug('harbor-lights-2021'));
    f.omdb.title = 'Harbor \u2192 Lights';
    expect(lintDisplayTitle(f).map((i) => i.rule)).toContain('forbidden-char');
    const g = clone(filmBySlug('harbor-lights-2021'));
    g.omdb.title = 'Harbor Lights \u{1F3AC}';
    expect(lintDisplayTitle(g).map((i) => i.rule)).toContain('forbidden-char');
  });
});

// ---------------------------------------------------------------------------------------------
// The OMDb Awards text holds ". " itself ("Won 2 Oscars. 112 wins & 52 nominations total"). It is
// quoted verbatim, kept whole inside one sentence, and counts as why-split evidence.

describe('OMDb Awards string that contains ". " (verbatim restatement)', () => {
  const AWARDS = 'Won 2 Oscars. 112 wins & 52 nominations total';
  const base = get('crimson-static-2022');
  const filmWith = (awards: string | null) => ({ ...filmBySlug(base.slug), omdb: { ...filmBySlug(base.slug).omdb, awards } });
  const lintWith = (a: Article, awards: string | null = AWARDS) => lintCopy(a, { film: filmWith(awards), stats: stats[a.slug] });
  const textIn = (text: string): Article => {
    const a = clone(base);
    a.sections.find((s) => s.id === 'the-film')!.paragraphs[0] += ` ${text}`;
    return a;
  };
  const claimRules = (a: Article, awards: string | null = AWARDS) =>
    lintWith(a, awards).filter((i) => i.rule === 'must-cite' || i.rule === 'number-literal').map((i) => i.rule);

  it('the fixture film itself has no awards, so the baseline is clean', () => {
    expect(lintWith(base, null)).toEqual([]);
  });

  it('quoted exactly, the string passes: no must-cite and no number-literal', () => {
    expect(claimRules(textIn(`OMDb records the awards as: ${AWARDS}.`))).toEqual([]);
    expect(claimRules(textIn(`${AWARDS}.`))).toEqual([]);
  });

  it('the exemption survives case and extra whitespace', () => {
    expect(claimRules(textIn('OMDb lists WON 2 OSCARS.  112 wins & 52 nominations TOTAL.'))).toEqual([]);
  });

  it('the exemption covers the whole sentence, as before, but only that sentence', () => {
    const a = textIn(`The record reads ${AWARDS}. Critics say it won a festival prize.`);
    const found = lintWith(a).filter((i) => i.rule === 'must-cite');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((i) => /festival prize/.test(i.message))).toBe(true);
  });

  it('works when the Awards string itself ends with a full stop', () => {
    const awards = 'Won 1 Oscar. 5 wins.';
    const a = textIn('The record reads Won 1 Oscar. 5 wins. Another sentence says it was nominated for a prize.');
    const found = lintWith(a, awards).filter((i) => i.rule === 'must-cite');
    expect(found.map((i) => i.message).join('|')).toMatch(/nominated/);
    expect(found.map((i) => i.message).join('|')).not.toMatch(/Won 1 Oscar|5 wins/);
    expect(lintWith(a, awards).filter((i) => i.rule === 'number-literal')).toEqual([]);
  });

  it('a partial or altered quote still needs a cite', () => {
    expect(claimRules(textIn('It Won 2 Oscars.'))).toEqual(expect.arrayContaining(['must-cite', 'number-literal']));
    expect(claimRules(textIn('Won 3 Oscars. 112 wins & 52 nominations total.'))).toEqual(expect.arrayContaining(['must-cite', 'number-literal']));
  });

  it('a cite on the sentence works as before', () => {
    const a = textIn('The film won an award at a festival.{{cite:tudum}}');
    a.sources = [{ id: 'tudum', url: 'https://www.netflix.com/tudum/top10', title: 'Top 10', publisher: 'Netflix Tudum', accessed: '2026-10-16', supports: 'Chart.' }];
    expect(lintWith(a).filter((i) => i.rule === 'must-cite')).toEqual([]);
  });

  describe('as why-split evidence', () => {
    const whySplit = (paragraphs: string[]): Article => {
      const a = clone(base);
      a.sections.find((s) => s.id === 'why-split')!.paragraphs = paragraphs;
      return a;
    };
    const direction = 'Audiences rate it sharply higher than critics, a wide gap of {{gapAbs}} points.';
    const evidence = (a: Article, awards: string | null = AWARDS) => lintWith(a, awards).filter((i) => i.rule === 'why-split').map((i) => i.message);

    it('counts as one of the two required evidence fields', () => {
      const without = whySplit([direction, 'The vote pool is {{votes}} strong.']);
      expect(evidence(without).join('|')).toMatch(/has 1/);
      const withAwards = whySplit([direction, 'The vote pool is {{votes}} strong.', `OMDb lists the awards as ${AWARDS}.`]);
      expect(evidence(withAwards)).toEqual([]);
    });

    it('is the second field even when it is the only quoted text next to the direction sentence', () => {
      expect(evidence(whySplit([direction, `The record reads ${AWARDS}, and the Metascore is {{metascore}}.`]))).toEqual([]);
    });

    it('does not count when altered or invented', () => {
      expect(evidence(whySplit([direction, 'The vote pool is {{votes}} strong.', 'OMDb lists Won 3 Oscars. 112 wins & 52 nominations total.'])).join('|')).toMatch(/has 1/);
      expect(evidence(whySplit([direction, 'The vote pool is {{votes}} strong.', 'The film won two festival awards.'])).join('|')).toMatch(/has 1/);
    });

    it('does not count when the film has no Awards string', () => {
      expect(evidence(whySplit([direction, 'The vote pool is {{votes}} strong.', `The record reads ${AWARDS}.`]), null).join('|')).toMatch(/has 1/);
    });
  });
});

describe('splitSentences with verbatim spans', () => {
  const { splitSentences } = jest.requireActual('../../lib/blog/sentences') as typeof import('../../lib/blog/sentences');
  const A = 'Won 2 Oscars. 112 wins & 52 nominations total';
  it('does not cut inside the span, and returns it as written', () => {
    expect(splitSentences(`It says ${A}. Next one.`, [A])).toEqual([`It says ${A}.`, 'Next one.']);
    expect(splitSentences(`It says won 2 oscars. 112 wins & 52 nominations total. Next.`, [A])).toEqual(['It says won 2 oscars. 112 wins & 52 nominations total.', 'Next.']);
  });
  it('without a span the old splitting applies', () => {
    expect(splitSentences(`It says ${A}. Next one.`)).toEqual(['It says Won 2 Oscars.', '112 wins & 52 nominations total.', 'Next one.']);
  });
  it('keeps a cite marker with the sentence the span ends', () => {
    expect(splitSentences(`It says ${A}.{{cite:x}} Next.`, [A])).toEqual([`It says ${A}.{{cite:x}}`, 'Next.']);
  });
});

// ---------------------------------------------------------------------------------------------
// Wordings the writer brief recommends must pass the lint (tests keep the brief honest).

describe('brief-recommended wordings pass the lint', () => {
  const inWhySplit = (slug: string, text: string): Article => {
    const a = clone(get(slug));
    a.sections.find((s) => s.id === 'why-split')!.paragraphs[0] += ` ${text}`;
    return a;
  };
  const inMore = (slug: string, text: string): Article => {
    const a = clone(get(slug));
    a.sections.find((s) => s.id === 'the-film')!.paragraphs[0] += ` ${text}`;
    return a;
  };
  const slugs = ['harbor-lights-2021', 'crimson-static-2022', 'salt-and-iron-2019', 'the-quiet-orchard-2023'];

  it.each(slugs)('hours window in words only (%s)', (slug) => {
    const a = inMore(slug, 'It logged {{hours}} hours viewed in its opening weeks on the chart.');
    expect(lint(a)).toEqual([]);
  });
  it('the digit version of the window fails (why the brief gives the digit-free wording)', () => {
    expect(rules(inMore('harbor-lights-2021', 'It logged {{hours}} hours viewed in its first 91 days on the chart.'))).toContain('number-literal');
  });

  it.each(slugs)('naming other films qualitatively is allowed, numbers for them are not (%s)', (slug) => {
    expect(lint(inMore(slug, 'Films such as The Gray Man and Back in Action lean the same way among the genre peers.'))).toEqual([]);
    expect(rules(inMore(slug, 'The Gray Man scores 6.1 on IMDb.'))).toContain('score-literal');
    expect(rules(inMore(slug, 'The Gray Man ranks 12 in the set.'))).toContain('number-literal');
  });

  it.each([
    ['harbor-lights-2021', 'critics-higher'],
    ['crimson-static-2022', 'audience-higher'],
  ])('Metascore near the audience score while RT is far (%s)', (slug) => {
    const a = inWhySplit(slug, 'At {{metascore}}, the Metascore lands nearer the audience figure than the Rotten Tomatoes percentage does.');
    expect(lint(a)).toEqual([]);
  });

  it.each(slugs.slice(0, 2))('genre median opposes the film (%s)', (slug) => {
    const a = inWhySplit(slug, 'The median difference for the {{genreCount}} {{genre}} films in this set is {{genreMedianGap}}, so the typical title in the genre leans the opposite way from this one.');
    expect(lint(a)).toEqual([]);
  });
});
