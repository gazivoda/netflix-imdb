import { videoObject, graph, absoluteUrl } from '../../lib/seo';
import { PROMO_VIDEO } from '../../lib/promo-video';
import { SITE_URL } from '../../lib/content';
import { existsSync } from 'fs';
import { join } from 'path';

describe('videoObject (home page promo)', () => {
  const v = videoObject() as Record<string, unknown>;

  it('is a VideoObject with the required fields', () => {
    expect(v['@type']).toBe('VideoObject');
    expect(v.name).toBe('Rating Watch in 30 seconds');
    expect(typeof v.description).toBe('string');
    expect((v.description as string).length).toBeGreaterThan(40);
    expect(v.inLanguage).toBe('en');
  });

  it('qualifies score availability in the shared visible and structured description', () => {
    expect(PROMO_VIDEO.caption).toContain('where available');
    expect(PROMO_VIDEO.caption).not.toContain('every Netflix title card');
    expect(v.description).toBe(PROMO_VIDEO.caption);
  });

  it('uses absolute https URLs on the site origin for thumbnail and content', () => {
    expect(v.thumbnailUrl).toBe(`${SITE_URL}/video/rating-watch-promo-poster.webp`);
    expect(v.contentUrl).toBe(`${SITE_URL}/video/rating-watch-promo.mp4`);
    expect(v.thumbnailUrl).toBe(absoluteUrl(PROMO_VIDEO.poster));
    for (const u of [v.thumbnailUrl, v.contentUrl] as string[]) expect(u).toMatch(/^https:\/\//);
  });

  it('has no embedUrl (self-hosted file, no player page)', () => {
    expect(v).not.toHaveProperty('embedUrl');
  });

  it('has an ISO 8601 date and a PT30S duration', () => {
    expect(v.uploadDate).toBe('2026-10-20T00:00:00+00:00'); // a time zone is required, not a bare date
    expect(v.uploadDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/);
    expect(Number.isNaN(Date.parse(v.uploadDate as string))).toBe(false);
    expect(v.duration).toBe('PT30S');
    expect(v.duration).toMatch(/^PT(\d+H)?(\d+M)?(\d+S)?$/);
  });

  it('has no undefined values and serialises to JSON unchanged', () => {
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
    expect(Object.values(v).every((x) => x !== undefined)).toBe(true);
  });

  it('describes files that exist in /public', () => {
    expect(existsSync(join(__dirname, '../../public', PROMO_VIDEO.src))).toBe(true);
    expect(existsSync(join(__dirname, '../../public', PROMO_VIDEO.poster))).toBe(true);
  });

  it('copy follows the site rules: two sentences, no em dash, no emoji, no arrows', () => {
    const caption = PROMO_VIDEO.caption;
    expect(caption.match(/\.(\s|$)/g)).toHaveLength(2);
    expect(caption).not.toMatch(/[—–]/);
    expect(caption).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(caption).not.toMatch(/[←-⇿]/);
    expect(PROMO_VIDEO.playLabel).not.toMatch(/sound/i);
  });

  it('sits in the home graph next to the FAQPage', () => {
    const g = graph({ '@type': 'FAQPage' }, v) as { '@graph': { '@type': string }[] };
    expect(g['@graph'].map((n) => n['@type'])).toEqual(['FAQPage', 'VideoObject']);
  });
});
