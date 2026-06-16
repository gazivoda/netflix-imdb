import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/content';

// Explicitly welcome AI crawlers — these are the bots that feed answers to
// ChatGPT, Claude, Perplexity, Gemini and Google AI Overviews. Blocking them
// (the default for many sites) is the #1 way to lose AI search visibility.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/' })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
