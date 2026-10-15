import type { MetadataRoute } from 'next';
import { PAGES } from '../lib/pages';
import { absoluteUrl } from '../lib/seo';

// lastModified comes from each page's real edit date in the registry. A
// build-time `new Date()` on every URL is a lie crawlers learn to ignore.
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: new Date(`${p.updated}T00:00:00Z`),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
