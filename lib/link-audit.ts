// Pure on-page / internal-link analysis over rendered HTML. No fs, no network,
// no imports: scripts/check-links.mjs loads this file directly with Node's
// type stripping, and jest unit-tests it with small HTML fixtures.

export interface AuditPage {
  /** Site path the HTML was served at, e.g. "/" or "/install". */
  path: string;
  html: string;
}

export type Severity = 'error' | 'warn';

export interface Finding {
  severity: Severity;
  code: string;
  path: string;
  message: string;
  /** Link target (normalized path) for link-related findings. */
  target?: string;
}

export interface AuditOptions {
  /** Origin used to tell internal absolute URLs from external ones. */
  siteUrl: string;
  /** Paths that must be reachable pages (the page registry). */
  registry: string[];
  /** Other internal targets that are valid but not pages (assets, routes). Strings or RegExps. */
  allowTargets?: (string | RegExp)[];
  /** Max clicks from "/" before a registry page is flagged. Default 2. */
  maxDepth?: number;
}

export interface AuditResult {
  findings: Finding[];
  /** Click depth from "/" for every registry path (Infinity = unreachable). */
  depth: Record<string, number>;
  /** Inbound internal link count per registry path (self-links excluded). */
  inbound: Record<string, number>;
}

interface Attrs {
  [name: string]: string;
}

interface LinkInfo {
  href: string;
  attrs: Attrs;
  text: string;
  inner: string;
}

const stripNoise = (html: string): string =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<template\b[\s\S]*?<\/template\s*>/gi, '');

function parseAttrs(src: string): Attrs {
  const attrs: Attrs = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

const textOf = (html: string): string =>
  decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

function tags(html: string, name: string): Attrs[] {
  const re = new RegExp(`<${name}\\b([^>]*)>`, 'gi');
  const out: Attrs[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(parseAttrs(m[1]));
  return out;
}

function elements(html: string, name: string): { attrs: Attrs; inner: string }[] {
  const re = new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}\\s*>`, 'gi');
  const out: { attrs: Attrs; inner: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ attrs: parseAttrs(m[1]), inner: m[2] });
  return out;
}

/** Normalize an href seen on `fromPath` to an internal path, or null if external/non-navigational. */
export function resolveInternal(href: string, fromPath: string, siteUrl: string): string | null {
  const h = href.trim();
  if (!h || h.startsWith('#')) return null;
  if (/^(mailto|tel|sms|javascript|data|blob):/i.test(h)) return null;
  let url: URL;
  try {
    url = new URL(h, `${siteUrl}${fromPath}`);
  } catch {
    return null;
  }
  if (url.origin !== new URL(siteUrl).origin) return null;
  const p = url.pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

const isExternal = (href: string, siteUrl: string): boolean => {
  const h = href.trim();
  if (!/^(https?:)?\/\//i.test(h)) return false;
  try {
    return new URL(h, siteUrl).origin !== new URL(siteUrl).origin;
  } catch {
    return false;
  }
};

function linkText(l: { attrs: Attrs; inner: string }): string {
  if (l.attrs['aria-label']?.trim() || l.attrs['aria-labelledby']?.trim()) return 'aria';
  const t = textOf(l.inner.replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, (svg) => {
    // keep an SVG <title> / aria-label as accessible text
    const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(svg)?.[1] ?? '';
    const label = /aria-label\s*=\s*"([^"]*)"/i.exec(svg)?.[1] ?? '';
    return ` ${title} ${label} `;
  }));
  if (t) return t;
  for (const img of tags(l.inner, 'img')) if (img.alt?.trim()) return img.alt.trim();
  return l.attrs.title?.trim() ?? '';
}

function extractLinks(html: string): LinkInfo[] {
  return elements(html, 'a')
    .filter((a) => a.attrs.href !== undefined)
    .map((a) => ({ href: a.attrs.href, attrs: a.attrs, text: linkText(a), inner: a.inner }));
}

export function analyzePages(pages: AuditPage[], opts: AuditOptions): AuditResult {
  const { siteUrl, registry } = opts;
  const maxDepth = opts.maxDepth ?? 2;
  const findings: Finding[] = [];
  const add = (severity: Severity, code: string, path: string, message: string, target?: string) =>
    findings.push({ severity, code, path, message, ...(target ? { target } : {}) });

  const registrySet = new Set(registry);
  const allow = opts.allowTargets ?? [];
  const isAllowed = (t: string) =>
    registrySet.has(t) || allow.some((a) => (typeof a === 'string' ? a === t : a.test(t)));

  const byPath = new Map(pages.map((p) => [p.path, p]));
  const edges = new Map<string, Set<string>>(); // from -> internal page targets
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();

  for (const page of pages) {
    const html = stripNoise(page.html);
    const head = html.match(/<head\b[\s\S]*?<\/head\s*>/i)?.[0] ?? html;
    const noindex = tags(head, 'meta').some(
      (m) => m.name?.toLowerCase() === 'robots' && /noindex/i.test(m.content ?? ''),
    );
    const own = new Set<string>();
    edges.set(page.path, own);

    // --- head: title / description / canonical (skipped for noindex pages) ---
    if (!noindex) {
      const title = textOf(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1] ?? '');
      if (!title) add('error', 'missing-title', page.path, 'Missing or empty <title>');
      else titles.set(title, [...(titles.get(title) ?? []), page.path]);

      const desc = (tags(head, 'meta').find((m) => m.name?.toLowerCase() === 'description')?.content ?? '').trim();
      if (!desc) add('error', 'missing-description', page.path, 'Missing or empty meta description');
      else descriptions.set(desc, [...(descriptions.get(desc) ?? []), page.path]);

      const canonicals = tags(head, 'link').filter((l) => l.rel?.toLowerCase().split(/\s+/).includes('canonical'));
      if (canonicals.length === 0) {
        add('error', 'missing-canonical', page.path, 'Missing <link rel="canonical">');
      } else {
        if (canonicals.length > 1) add('error', 'multiple-canonicals', page.path, `${canonicals.length} canonical links`);
        const href = canonicals[0].href ?? '';
        const expected = page.path === '/' ? [siteUrl, `${siteUrl}/`] : [`${siteUrl}${page.path}`];
        if (!expected.includes(href)) {
          add('error', 'canonical-mismatch', page.path, `Canonical is "${href}", expected "${expected[0]}"`);
        }
      }
    }

    // --- headings ---
    const h1s = elements(html, 'h1');
    if (h1s.length === 0) add('error', 'missing-h1', page.path, 'No <h1>');
    else if (h1s.length > 1) add('error', 'duplicate-h1', page.path, `${h1s.length} <h1> elements`);
    else if (!textOf(h1s[0].inner)) add('error', 'missing-h1', page.path, '<h1> is empty');

    // --- images ---
    for (const img of tags(html, 'img')) {
      if (img.alt === undefined) {
        add('error', 'img-no-alt', page.path, `<img> without alt: ${(img.src ?? '').slice(0, 80) || '(no src)'}`);
      }
    }

    // --- links ---
    for (const link of extractLinks(html)) {
      const href = link.href.trim();
      const target = resolveInternal(href, page.path, siteUrl);
      if (target !== null) {
        if (!isAllowed(target)) add('error', 'broken-link', page.path, `Link to unknown path ${target}`, target);
        else if (registrySet.has(target) && target !== page.path) own.add(target);
      }
      if (!link.text) {
        add('error', 'link-no-text', page.path, `Link with no accessible text: ${href.slice(0, 80)}`, target ?? href);
      }
      if (isExternal(href, siteUrl) && link.attrs.target?.toLowerCase() === '_blank') {
        const rel = (link.attrs.rel ?? '').toLowerCase().split(/\s+/);
        if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
          add('error', 'external-no-noopener', page.path, `target=_blank without rel="noopener": ${href.slice(0, 80)}`, href);
        }
      }
    }
  }

  const dupes = (m: Map<string, string[]>, code: string, what: string) => {
    for (const [value, paths] of m) {
      if (paths.length > 1) {
        for (const p of paths) {
          add('error', code, p, `${what} shared with ${paths.filter((x) => x !== p).join(', ')}: "${value.slice(0, 60)}"`);
        }
      }
    }
  };
  dupes(titles, 'duplicate-title', 'Title');
  dupes(descriptions, 'duplicate-description', 'Description');

  // --- registry coverage, orphans, click depth ---
  const inbound: Record<string, number> = Object.fromEntries(registry.map((p) => [p, 0]));
  for (const targets of edges.values()) for (const t of targets) if (t in inbound) inbound[t]++;

  const depth: Record<string, number> = Object.fromEntries(registry.map((p) => [p, Infinity]));
  if ('/' in depth) {
    depth['/'] = 0;
    const queue = ['/'];
    for (let i = 0; i < queue.length; i++) {
      for (const t of edges.get(queue[i]) ?? []) {
        if (depth[t] === Infinity) {
          depth[t] = depth[queue[i]] + 1;
          queue.push(t);
        }
      }
    }
  }

  for (const p of registry) {
    if (!byPath.has(p)) {
      add('error', 'page-missing', p, 'Registry page has no rendered HTML');
      continue;
    }
    if (p !== '/' && inbound[p] === 0) add('error', 'orphan', p, 'No internal links point to this page');
    else if (depth[p] === Infinity) add('error', 'unreachable', p, 'Not reachable by clicking from the homepage');
    else if (depth[p] > maxDepth) add('error', 'deep-page', p, `Click depth ${depth[p]} exceeds ${maxDepth}`);
  }

  return { findings, depth, inbound };
}

/** Render findings as a fixed-width text table (empty string when there are none). */
export function formatTable(findings: Finding[]): string {
  if (findings.length === 0) return '';
  const rows = [['SEV', 'CHECK', 'PAGE', 'DETAIL'], ...findings.map((f) => [f.severity, f.code, f.path, f.message])];
  const widths = [0, 1, 2].map((c) => Math.max(...rows.map((r) => r[c].length)));
  const line = (r: string[]) => [0, 1, 2].map((c) => r[c].padEnd(widths[c])).join('  ') + '  ' + r[3];
  return [line(rows[0]), widths.map((w) => '-'.repeat(w)).join('  ') + '  ------', ...rows.slice(1).map(line)].join('\n');
}
