import * as content from '../lib/content';
import { buildLlmsTxt, buildLlmsFullTxt } from '../lib/llms';

const PICTOGRAPH = /\p{Extended_Pictographic}/u;

function strings(value: unknown, path: string, out: Array<[string, string]> = []) {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  }
  return out;
}

describe('emoji-free content', () => {
  const all = strings(content, 'content');

  it('walks a meaningful number of strings', () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it.each(all)('%s has no emoji or pictographs', (_path, text) => {
    expect(text).not.toMatch(PICTOGRAPH);
  });

  it('FEATURES use short mono index strings', () => {
    content.FEATURES.forEach((f, i) => {
      expect(f.icon).toBe(String(i + 1).padStart(2, '0'));
    });
  });

  it('SHOWCASE scores are plain text, and series carry no Rotten Tomatoes value', () => {
    for (const [title, s] of Object.entries(content.SHOWCASE)) {
      expect(s.imdb).toMatch(/^\d\.\d$/);
      if (s.rt !== undefined) expect(s.rt).toMatch(/^\d+%$/);
      if (title === 'Stranger Things') expect(s.rt).toBeUndefined();
    }
  });

  it('generated llms files contain no emoji', () => {
    expect(buildLlmsTxt()).not.toMatch(PICTOGRAPH);
    expect(buildLlmsFullTxt()).not.toMatch(PICTOGRAPH);
  });
});
