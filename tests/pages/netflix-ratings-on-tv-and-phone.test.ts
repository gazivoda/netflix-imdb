/** @jest-environment node */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { getPage, pagesInGroup } from '../../lib/pages';
import { pageMetadata, renderedTitle } from '../../lib/seo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: unknown) => string };

const PATH = '/how-to/netflix-ratings-on-tv-and-phone';
const source = readFileSync(join(__dirname, '../../app', PATH, 'page.tsx'), 'utf8');
const html = renderToStaticMarkup(createElement(require('../../app/how-to/netflix-ratings-on-tv-and-phone/page').default));

describe(PATH, () => {
  it('is registered as a guide with the right metadata', () => {
    const page = getPage(PATH);
    expect(page.group).toBe('guide');
    expect(page.ogType).toBe('article');
    expect(page.published).toBe('2026-11-09');
    expect(pagesInGroup('guide').map((p) => p.path)).toContain(PATH);
    expect(renderedTitle(page).length).toBeLessThanOrEqual(65);
    expect(page.description.length).toBeLessThanOrEqual(155);
    expect(pageMetadata(PATH).alternates?.canonical).toBe(PATH);
  });

  it('renders one h1 and an answer-first lede of 40-60 words', () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    const lede = html.match(/<p class="[^"]*lede[^"]*">([\s\S]*?)<\/p>/)![1].replace(/<[^>]+>/g, ' ');
    const words = lede.trim().split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(40);
    expect(words).toBeLessThanOrEqual(60);
  });

  it('links to the install guide, the AR page, both sister guides, the comparison and the store', () => {
    for (const href of [
      '/install',
      '/camera-vision/ar',
      '/how-to/show-imdb-ratings-on-netflix',
      '/how-to/netflix-ratings-explained',
      '/compare/alternatives',
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(source).toContain('href={CHROME_WEB_STORE_URL}');
  });

  it('cites its primary sources', () => {
    for (const url of [
      'https://help.netflix.com/en/node/9898',
      'https://apps.apple.com/us/app/id1535719670',
      'https://addons.mozilla.org/en-US/firefox/addon/imdb-ratings-on-netflix/',
      'https://www.technipages.com/imdb-ratings-netflix-android',
    ]) {
      expect(html).toContain(url);
    }
  });

  it('says Rating Watch is untested in Safari and Firefox and offers no phone version', () => {
    expect(html).toMatch(/not been tested in Firefox or Safari/);
    expect(html).toMatch(/no phone version/i);
  });

  it('promises no trial, price or refund (Pro may not be on sale)', () => {
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    const text = main.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    expect(text).not.toMatch(/free trial|\$\d|refund|per month|a month|a year/i);
  });

  it('emits no FAQPage markup', () => {
    expect(source).toContain('faqSchema={false}');
    expect(html).not.toContain('"FAQPage"');
  });
});
