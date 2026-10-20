import { countRenderedWords, parseProse, plainText, splitFirstSentence } from '../../app/blog/_lib/prose';

describe('parseProse', () => {
  it('splits text, internal links and citation markers', () => {
    expect(parseProse('See [how it works](/compare/imdb-vs-rotten-tomatoes) now[2].')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', text: 'how it works', href: '/compare/imdb-vs-rotten-tomatoes' },
      { kind: 'text', text: ' now' },
      { kind: 'cite', n: 2 },
      { kind: 'text', text: '.' },
    ]);
  });

  it('leaves plain text and non-internal brackets alone', () => {
    expect(parseProse('No links here.')).toEqual([{ kind: 'text', text: 'No links here.' }]);
    expect(parseProse('[x](https://evil.test/a)')).toEqual([{ kind: 'text', text: '[x](https://evil.test/a)' }]);
    expect(parseProse('')).toEqual([]);
  });
});

describe('plainText', () => {
  it('reduces links to their anchor and keeps citation markers', () => {
    expect(plainText('A [b c](/x) d[1].')).toBe('A b c d[1].');
  });
});

describe('splitFirstSentence', () => {
  it('splits after the first sentence', () => {
    expect(splitFirstSentence('One two. Three four.')).toEqual(['One two.', 'Three four.']);
  });
  it('does not split inside a decimal, a link, or after an abbreviation', () => {
    expect(splitFirstSentence('It scores 6.4 on IMDb. Next.')[0]).toBe('It scores 6.4 on IMDb.');
    expect(splitFirstSentence('See [a. b](/x) here. Next.')[0]).toBe('See [a. b](/x) here.');
    expect(splitFirstSentence('Mr. Smith goes. Next.')[0]).toBe('Mr. Smith goes.');
  });
  it('returns the whole text when there is one sentence', () => {
    expect(splitFirstSentence('Only one sentence.')).toEqual(['Only one sentence.', '']);
    expect(splitFirstSentence('No full stop')).toEqual(['No full stop', '']);
  });
});

describe('countRenderedWords', () => {
  it('counts visible words, links as their anchor', () => {
    expect(countRenderedWords('one two [three four](/x)', 'five')).toBe(5);
  });
});
