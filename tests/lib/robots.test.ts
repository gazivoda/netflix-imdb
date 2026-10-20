import robots, {
  SEARCH_CRAWLERS,
  USER_FETCHERS,
  TRAINING_CRAWLERS,
} from '../../app/robots';
import { SITE_URL } from '../../lib/content';

const result = robots();
const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
const agentsOf = (r: (typeof rules)[number]) =>
  Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent];
const groupFor = (bot: string) => rules.find((r) => agentsOf(r).includes(bot));

const EXPECTED = [
  'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'Applebot', 'Googlebot', 'Bingbot',
  'ChatGPT-User', 'Claude-User',
  'GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'Applebot-Extended', 'Bytespider', 'cohere-ai',
];

describe('robots.txt', () => {
  it.each(EXPECTED)('lists %s and allows it', (bot) => {
    const group = groupFor(bot);
    expect(group).toBeDefined();
    expect(group!.allow).toBe('/');
  });

  it('has a generic group that allows / and disallows /account and /api/', () => {
    const star = groupFor('*');
    expect(star?.allow).toBe('/');
    expect(star?.disallow).toEqual(['/account', '/api/']);
  });

  it('disallows /account and /api/ in every group (named groups do not inherit "*")', () => {
    for (const r of rules) {
      expect(r.disallow).toContain('/account');
      expect(r.disallow).toContain('/api/');
    }
  });

  it('omits undocumented user-agents', () => {
    const all = rules.flatMap(agentsOf);
    expect(all).not.toContain('anthropic-ai');
    expect(all).not.toContain('Claude-Web');
  });

  it('has no duplicate agents across categories', () => {
    const all = [...SEARCH_CRAWLERS, ...USER_FETCHERS, ...TRAINING_CRAWLERS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('points to the sitemap and host', () => {
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(result.host).toBe(SITE_URL);
  });
});
