// Pure on-page SEO checker for rendered HTML. Takes {path, html} and returns
// findings; no filesystem or network, so it is unit-testable with small
// fixtures (tests/lib/html-seo.test.ts) and reused by scripts/validate-seo.mjs
// against the real `next build` output.

import { SITE_URL } from './content';

export interface SeoFinding {
  path: string;
  rule: string;
  message: string;
}

export interface PageInput {
  path: string;
  html: string;
  /** Override for tests; defaults to the build's SITE_URL. */
  siteUrl?: string;
}

const TITLE_MIN = 10;
const TITLE_MAX = 65;
const DESC_MIN = 70;
const DESC_MAX = 160;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

type Attrs = Record<string, string>;

function parseAttrs(tag: string): Attrs {
  const attrs: Attrs = {};
  const re = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

const tagsOf = (html: string, name: string): Attrs[] =>
  (html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? []).map(parseAttrs);

const stripNonContent = (html: string): string =>
  html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');

const visibleText = (html: string): string => decode(stripNonContent(html).replace(/<[^>]*>/g, ''));

/** Whitespace-insensitive form, so inline markup in the DOM can't break a text match. */
const squash = (s: string): string => s.replace(/\s+/g, '');

const BAD_STRINGS = /\bundefined\b|\bNaN\b|\[object Object\]/;

type Json = unknown;
type JsonObject = Record<string, Json>;
const isObject = (v: Json): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Visits every object nested anywhere in a JSON-LD value. */
function walk(value: Json, visit: (o: JsonObject) => void): void {
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit));
  else if (isObject(value)) {
    visit(value);
    Object.values(value).forEach((v) => walk(v, visit));
  }
}

const typesOf = (o: JsonObject): string[] => {
  const t = o['@type'];
  return Array.isArray(t) ? t.map(String) : t ? [String(t)] : [];
};

const isAbsoluteHttps = (u: string): boolean => {
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

export function checkPage({ path, html, siteUrl = SITE_URL }: PageInput): SeoFinding[] {
  const findings: SeoFinding[] = [];
  const fail = (rule: string, message: string) => findings.push({ path, rule, message });

  const metas = tagsOf(html, 'meta');
  const links = tagsOf(html, 'link');
  const metaBy = (key: 'name' | 'property', value: string) =>
    metas.filter((m) => (m[key] ?? '').toLowerCase() === value);
  // OG is spec'd as property=, Twitter as name=; real pages mix them, so accept both.
  const metaAny = (value: string) => [...metaBy('property', value), ...metaBy('name', value)];

  // <title>
  const titles = [...stripNonContent(html).matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
  if (titles.length !== 1) fail('title', `expected exactly one <title>, found ${titles.length}`);
  else {
    const t = decode(titles[0][1]).trim();
    if (t.length < TITLE_MIN || t.length > TITLE_MAX)
      fail('title', `title is ${t.length} chars (need ${TITLE_MIN}-${TITLE_MAX}): "${t}"`);
  }

  // meta description
  const descs = metaBy('name', 'description');
  if (descs.length !== 1) fail('description', `expected exactly one meta description, found ${descs.length}`);
  else {
    const d = (descs[0].content ?? '').trim();
    if (d.length < DESC_MIN || d.length > DESC_MAX)
      fail('description', `description is ${d.length} chars (need ${DESC_MIN}-${DESC_MAX})`);
  }

  // canonical
  const canonicals = links.filter((l) => (l.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'));
  if (canonicals.length !== 1) fail('canonical', `expected exactly one canonical, found ${canonicals.length}`);
  else {
    // The origin URL is the same resource with or without the trailing slash; Next emits it without.
    const expected = path === '/' ? [siteUrl, `${siteUrl}/`] : [`${siteUrl}${path}`];
    if (!expected.includes(canonicals[0].href ?? ''))
      fail('canonical', `canonical is "${canonicals[0].href}", expected "${expected[0]}"`);
  }

  // Open Graph / Twitter
  for (const key of ['og:title', 'og:description']) {
    if (!metaAny(key).some((m) => (m.content ?? '').trim())) fail('social', `missing ${key}`);
  }
  for (const key of ['og:image', 'twitter:image']) {
    const found = metaAny(key);
    if (!found.length) fail('social', `missing ${key}`);
    else if (!found.every((m) => isAbsoluteHttps(m.content ?? '')))
      fail('social', `${key} must be an absolute https URL (got "${found.map((m) => m.content).join('", "')}")`);
  }

  // H1
  const h1s = (stripNonContent(html).match(/<h1[\s>]/gi) ?? []).length;
  if (h1s !== 1) fail('h1', `expected exactly one <h1>, found ${h1s}`);

  // <html lang>, viewport
  const htmlTag = tagsOf(html, 'html')[0];
  if (!htmlTag?.lang?.trim()) fail('lang', '<html> has no lang attribute');
  if (!metaBy('name', 'viewport').length) fail('viewport', 'missing viewport meta');

  // robots
  for (const m of [...metaBy('name', 'robots'), ...metaBy('name', 'googlebot')]) {
    if (/noindex/i.test(m.content ?? '')) fail('noindex', `${m.name} meta contains noindex ("${m.content}")`);
  }

  // JSON-LD
  const blocks = [
    ...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => m[1]);
  if (!blocks.length) fail('jsonld', 'no JSON-LD blocks found');
  const parsed: Json[] = [];
  blocks.forEach((raw, i) => {
    try {
      const data: Json = JSON.parse(raw);
      parsed.push(data);
      for (const top of Array.isArray(data) ? data : [data]) {
        if (!isObject(top) || !('@context' in top)) fail('jsonld', `JSON-LD block ${i + 1} has no @context`);
      }
    } catch (e) {
      fail('jsonld', `JSON-LD block ${i + 1} is not valid JSON: ${(e as Error).message}`);
    }
  });

  // Bad serialised values, in JSON-LD, head metadata and visible copy.
  const badSources: [string, string][] = [
    ['JSON-LD', blocks.join('\n')],
    ['title', titles.map((t) => decode(t[1])).join(' ')],
    ['meta', metas.map((m) => m.content ?? '').join('\n')],
    ['page text', visibleText(html)],
  ];
  for (const [where, text] of badSources) {
    const hit = BAD_STRINGS.exec(text);
    if (hit) {
      const around = text.slice(Math.max(0, hit.index - 30), hit.index + 40).replace(/\s+/g, ' ');
      fail('bad-value', `"${hit[0]}" appears in ${where}: ...${around}...`);
    }
  }

  // @id references must resolve within the page's combined graph.
  const defined = new Set<string>();
  const refs: string[] = [];
  for (const data of parsed) {
    walk(data, (o) => {
      const id = o['@id'];
      if (typeof id !== 'string') return;
      if (Object.keys(o).length === 1) refs.push(id);
      else defined.add(id);
    });
  }
  for (const id of new Set(refs)) {
    if (!defined.has(id)) fail('jsonld-ref', `{ "@id": "${id}" } is referenced but never defined on this page`);
  }

  // FAQPage must be backed by visible FAQ copy (questions and answers).
  const faqNodes: JsonObject[] = [];
  parsed.forEach((data) => walk(data, (o) => typesOf(o).includes('FAQPage') && faqNodes.push(o)));
  if (faqNodes.length) {
    const text = squash(visibleText(html));
    const qs: JsonObject[] = [];
    faqNodes.forEach((n) => walk(n.mainEntity, (o) => typesOf(o).includes('Question') && qs.push(o)));
    if (!qs.length) fail('faq', 'FAQPage has no Question entries');
    for (const q of qs) {
      const name = typeof q.name === 'string' ? q.name : '';
      const answer =
        isObject(q.acceptedAnswer) && typeof q.acceptedAnswer.text === 'string' ? q.acceptedAnswer.text : '';
      if (!name || !text.includes(squash(name))) fail('faq', `FAQPage question not shown on page: "${name}"`);
      else if (!answer || !text.includes(squash(visibleText(answer))))
        fail('faq', `FAQPage answer not shown on page for: "${name}"`);
    }
  }

  return findings;
}

/** Maps a registry path to its prerendered file under .next/server/app. */
export const htmlFileForPath = (path: string): string => (path === '/' ? 'index.html' : `${path.slice(1)}.html`);
