import { mean, median, pearson, round, summarize, toGapRow } from '../../lib/research-stats';

describe('basic statistics', () => {
  it('mean', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBeNaN();
  });

  it('median handles odd, even and unsorted input without mutating it', () => {
    const xs = [9, 1, 5];
    expect(median(xs)).toBe(5);
    expect(xs).toEqual([9, 1, 5]);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it('round', () => {
    expect(round(1.25, 1)).toBe(1.3);
    expect(round(-0.04, 1)).toBeCloseTo(0, 5);
  });
});

describe('pearson', () => {
  it('is 1 for a perfect positive line and -1 for a perfect negative line', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it('matches a hand-computed value', () => {
    // x=[1..5], y=[2,1,4,3,5]: cov=8, var_x=10, var_y=10 -> r=0.8
    expect(pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.8, 10);
  });

  it('is null when undefined', () => {
    expect(pearson([1], [1])).toBeNull();
    expect(pearson([3, 3, 3], [1, 2, 3])).toBeNull();
  });

  it('rejects mismatched lengths', () => {
    expect(() => pearson([1, 2], [1])).toThrow();
  });
});

describe('summarize', () => {
  // imdb x10 vs rt: gaps are +20, -30, 0, +10  (rt - imdbScaled)
  const fixture = [
    { title: 'Critics Darling', imdb: 6.0, rt: 80 },
    { title: 'Crowd Pleaser', imdb: 8.0, rt: 50 },
    { title: 'Agreement', imdb: 7.0, rt: 70 },
    { title: 'Slight Critics', imdb: 7.5, rt: 85 },
  ];

  it('normalises IMDb x10 and signs the gap as rt - imdb', () => {
    expect(toGapRow(fixture[0])).toMatchObject({ imdbScaled: 60, gap: 20 });
    expect(toGapRow(fixture[1])).toMatchObject({ imdbScaled: 80, gap: -30 });
  });

  it('avoids floating-point noise when scaling (e.g. 7.1 x 10)', () => {
    expect(toGapRow({ title: 'x', imdb: 7.1, rt: 71 })).toMatchObject({ imdbScaled: 71, gap: 0 });
  });

  it('computes the headline numbers', () => {
    const s = summarize(fixture);
    expect(s.n).toBe(4);
    expect(s.meanAbsGap).toBe(15); // (20+30+0+10)/4
    expect(s.medianAbsGap).toBe(15); // sorted 0,10,20,30 -> (10+20)/2
    expect(s.meanSignedGap).toBe(0); // (20-30+0+10)/4
    expect(s.shareBigGap).toBe(0.5); // |20| and |30| are >= 15
    expect(s.criticsHigherCount).toBe(2);
    expect(s.audienceHigherCount).toBe(1);
    expect(s.tieCount).toBe(1);
    expect(s.biggestCriticsHigher?.title).toBe('Critics Darling');
    expect(s.biggestAudienceHigher?.title).toBe('Crowd Pleaser');
  });

  it('counts a gap of exactly the threshold as big', () => {
    const s = summarize([{ title: 'edge', imdb: 6.5, rt: 80 }]); // gap 15
    expect(s.shareBigGap).toBe(1);
  });

  it('returns null extremes when everyone is on one side', () => {
    const s = summarize([
      { title: 'a', imdb: 5, rt: 60 },
      { title: 'b', imdb: 6, rt: 90 },
    ]);
    expect(s.biggestAudienceHigher).toBeNull();
    expect(s.biggestCriticsHigher?.title).toBe('b');
  });
});
