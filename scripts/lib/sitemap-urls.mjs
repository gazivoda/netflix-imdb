// Pure sitemap.xml parsing, shared by scripts/ping-indexnow.mjs and its jest test.
// No dependencies: Next's generated sitemap is a flat <urlset>, so a tolerant
// regex pass is enough and avoids pulling an XML parser into the repo.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .trim();
}

/**
 * Parse a sitemap into `{ url, lastmod }` entries (document order, de-duplicated).
 * Throws on a <sitemapindex> (we'd need to fetch children) or when no URLs are found,
 * so a bad response can never silently submit an empty list.
 */
export function parseSitemap(xml) {
  if (typeof xml !== 'string' || !xml.trim()) throw new Error('sitemap is empty');
  if (/<sitemapindex[\s>]/i.test(xml)) {
    throw new Error('sitemap index files are not supported; point at a <urlset> sitemap');
  }
  const seen = new Set();
  const entries = [];
  for (const [, block] of xml.matchAll(/<url(?:\s[^>]*)?>([\s\S]*?)<\/url>/gi)) {
    const loc = block.match(/<loc(?:\s[^>]*)?>([\s\S]*?)<\/loc>/i);
    if (!loc) continue;
    const url = decode(loc[1]);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const lastmod = block.match(/<lastmod(?:\s[^>]*)?>([\s\S]*?)<\/lastmod>/i);
    entries.push({ url, lastmod: lastmod ? decode(lastmod[1]) : null });
  }
  if (entries.length === 0) throw new Error('no <url><loc> entries found in sitemap');
  return entries;
}

/** URLs only, optionally restricted to one host (IndexNow rejects mixed-host batches). */
export function sitemapUrls(xml, { host } = {}) {
  const urls = parseSitemap(xml).map((e) => e.url);
  if (!host) return { urls, skipped: [] };
  const keep = [];
  const skipped = [];
  for (const u of urls) {
    let h = null;
    try {
      h = new URL(u).host;
    } catch {}
    (h === host ? keep : skipped).push(u);
  }
  return { urls: keep, skipped };
}
