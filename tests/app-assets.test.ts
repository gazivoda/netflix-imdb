import { createElement } from 'react';
import manifest from '../app/manifest';
import NotFound, { metadata as notFoundMetadata } from '../app/not-found';
import { HOME_DESCRIPTION, pagesInGroup } from '../lib/pages';

// @types/react-dom is not installed, so load the server renderer untyped.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: unknown) => string };

// next/og needs a runtime jest cannot provide; capture what the icons ask it to render.
const imageResponse = jest.fn();
jest.mock('next/og', () => ({
  ImageResponse: function (_el: unknown, opts: unknown) {
    imageResponse(opts);
  },
}));

describe('web manifest', () => {
  const m = manifest();

  it('uses the brand name, home description and paper theme colors', () => {
    expect(m.name).toBe('Netflix Ratings');
    expect(m.short_name).toBeTruthy();
    expect(m.description).toBe(HOME_DESCRIPTION);
    expect(m.theme_color).toBe('#ece6d8');
    expect(m.background_color).toBe('#ece6d8');
    expect(m.start_url).toBe('/');
  });

  it('lists SVG, 180px apple and 512px PNG icons', () => {
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.type === 'image/svg+xml')).toBe(true);
    expect(icons.some((i) => i.sizes === '180x180' && i.type === 'image/png')).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512' && i.type === 'image/png')).toBe(true);
  });
});

describe('404 page', () => {
  it('is noindex and has no canonical', () => {
    expect(notFoundMetadata.robots).toMatchObject({ index: false });
    expect(notFoundMetadata.alternates).toBeUndefined();
  });

  it('links home, install, the comparison and every guide/compare page', () => {
    const html = renderToStaticMarkup(createElement(NotFound));
    for (const href of ['/', '/install', '/compare/imdb-vs-rotten-tomatoes']) {
      expect(html).toContain(`href="${href}"`);
    }
    for (const p of [...pagesInGroup('guide'), ...pagesInGroup('compare')]) {
      expect(html).toContain(`href="${p.path}"`);
    }
  });
});

describe('generated PNG icons', () => {
  it('apple-icon is a 180x180 PNG', async () => {
    const mod = await import('../app/apple-icon');
    expect(mod.contentType).toBe('image/png');
    mod.default();
    expect(imageResponse).toHaveBeenLastCalledWith({ width: 180, height: 180 });
  });

  it('icon is a 512x512 PNG', async () => {
    const mod = await import('../app/icon');
    expect(mod.contentType).toBe('image/png');
    mod.default();
    expect(imageResponse).toHaveBeenLastCalledWith({ width: 512, height: 512 });
  });
});
