import { getPage, pagesInGroup } from '../../lib/pages';
import { STEPS } from '../../app/how-to/show-imdb-ratings-on-netflix/steps';

const PATH = '/how-to/show-imdb-ratings-on-netflix';

describe('how-to: show IMDb ratings on Netflix', () => {
  it('is registered as a guide with the expected priority', () => {
    const page = getPage(PATH);
    expect(page.group).toBe('guide');
    expect(page.priority).toBe(0.9);
    expect(page.label).toBe('Show IMDb ratings on Netflix');
    expect(pagesInGroup('guide').map((p) => p.path)).toContain(PATH);
  });

  it('has non-empty HowTo steps', () => {
    expect(STEPS.length).toBeGreaterThanOrEqual(3);
    for (const s of STEPS) {
      expect(s.name.trim()).not.toBe('');
      expect(s.text.trim()).not.toBe('');
    }
  });
});
