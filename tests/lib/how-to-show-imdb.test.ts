import { getPage, pagesInGroup } from '../../lib/pages';
import { STEPS } from '../../app/how-to/show-imdb-ratings-on-netflix/steps';
import { createElement } from 'react';
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (element: unknown) => string };
import InstallPage from '../../app/install/page';

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

  it('directs readers to the live store and uses browser-managed installation', () => {
    const html = renderToStaticMarkup(createElement(InstallPage));
    expect(html).toContain('href="https://chromewebstore.google.com/detail/rating-watch-imdb-rotten/kljplalofcjpjdhceicjhnibllghdlpa"');
    expect(html).toContain('Add to Chrome');
    expect(html).toMatch(/updates? automatically|automatically updates?/i);
    expect(html).not.toMatch(/Load unpacked|Developer mode|unzip|\.zip|manifest\.json|download=""/i);
  });

  it('teaches store installation before browsing Netflix', () => {
    expect(STEPS[0].text).toContain('Chrome Web Store');
    expect(STEPS[0].text).toContain('Add to Chrome');
    expect(STEPS.map((s) => s.text).join(' ')).not.toMatch(/Load unpacked|Developer mode|unzip|\.zip/i);
  });
});
