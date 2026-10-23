import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/content';

// The site wants maximum visibility, so every documented crawler is allowed:
// search/citation bots, user-triggered fetchers and training bots alike.
// Note: Google-Extended governs Gemini training/grounding only, NOT Google Search
// (that is Googlebot). Likewise GPTBot/ClaudeBot are training crawlers, whereas
// OAI-SearchBot/Claude-SearchBot decide citability in ChatGPT/Claude search.
// anthropic-ai and Claude-Web are not documented by Anthropic (support.claude.com
// lists only ClaudeBot, Claude-User, Claude-SearchBot), so they are not listed.
export const SEARCH_CRAWLERS = [
  'Googlebot',
  'Bingbot',
  'Applebot',
  'OAI-SearchBot',
  'Claude-SearchBot',
  'PerplexityBot',
];

// Fetch on behalf of a user and may ignore robots.txt; listed for clarity.
export const USER_FETCHERS = ['ChatGPT-User', 'Claude-User', 'Perplexity-User'];

export const TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'cohere-ai',
];

// A crawler with its own group ignores the `*` group, so /api/ (JSON endpoints
// with nothing to index) is disallowed in each one. Keep /account crawlable:
// search engines must fetch it to read its noindex directive. Authentication
// protects account data; robots.txt is not an access control.
const PUBLIC = { allow: '/', disallow: ['/api/'] };

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', ...PUBLIC },
      { userAgent: SEARCH_CRAWLERS, ...PUBLIC },
      { userAgent: USER_FETCHERS, ...PUBLIC },
      { userAgent: TRAINING_CRAWLERS, ...PUBLIC },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
