// Inbound links to the blog from existing pages (spec Section 5, I8), gated on the hub state in the
// generated registry (I9) so the site never links a 404: with a hub that is not ready, no page links
// /blog and no title links an article. Static data only; no filesystem access.

import { BLOG_ARTICLE_PAGES, BLOG_HUB, type BlogArticlePage, type BlogHubState } from './registry.generated';

export const BLOG_HUB_PATH = '/blog';

/** True when the /blog hub is registered and may be linked. */
export const isBlogHubReady = (hub: BlogHubState = BLOG_HUB): boolean => hub.ready;

/** Path of the published analysis of the film with this IMDb id, or null (never matched by title). */
export function articlePathForImdbId(
  imdbId: string,
  hub: BlogHubState = BLOG_HUB,
  entries: readonly BlogArticlePage[] = BLOG_ARTICLE_PAGES,
): string | null {
  if (!hub.ready) return null;
  return entries.find((e) => e.imdbId === imdbId)?.path ?? null;
}
