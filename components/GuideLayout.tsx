import type { ReactNode } from 'react';
import g from './guide.module.css';
import c from './site-chrome.module.css';
import JsonLd from './JsonLd';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import { getPage } from '../lib/pages';
import { AUTHOR_NAME } from '../lib/content';
import { article, breadcrumbList, faqPage, graph, nodeId, softwareApplication, webPage } from '../lib/seo';

export interface Faq {
  q: string;
  /** Plain-text answer: used for FAQPage markup and as the visible text unless `aNode` is given. */
  a: string;
  /** Rich visible answer (for example with internal links). Never used in JSON-LD. */
  aNode?: ReactNode;
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/**
 * Shared shell for every content page: header, breadcrumb, byline with a real
 * updated date, JSON-LD graph (Breadcrumb + Article [+ extras] [+ FAQ]) and the
 * registry-driven footer. Page copy goes in children.
 *
 * The optional props below exist for the blog (articles are built from data); every
 * default reproduces the original output, so existing guide pages are unchanged.
 */
export default function GuideLayout({
  path,
  h1,
  lede,
  children,
  faqs,
  schema = [],
  crumbs = [],
  articleNode,
  webPageOptions,
  faqSchema = true,
  bylineHref = '/about',
  showPublished = false,
  meta,
  after,
}: {
  path: string;
  h1: string;
  lede: ReactNode;
  children: ReactNode;
  faqs?: Faq[];
  schema?: Record<string, unknown>[];
  /** Intermediate breadcrumb steps between Home and this page. */
  crumbs?: { name: string; path: string }[];
  /** Replaces the default `Article` node (for example a `BlogPosting`). */
  articleNode?: Record<string, unknown>;
  /** Passed to `webPage()` (node type, `about`). */
  webPageOptions?: Parameters<typeof webPage>[1];
  /** false: the FAQ is shown but no FAQPage markup is emitted. */
  faqSchema?: boolean;
  /** Byline link target. An internal path (starts with "/") opens in the same tab. */
  bylineHref?: string;
  /** Show "Published {date}" in the byline, before "Updated". */
  showPublished?: boolean;
  /** Extra byline line under the byline. */
  meta?: ReactNode;
  /** Rendered after the FAQ, inside the article column. */
  after?: ReactNode;
}) {
  const page = getPage(path);
  const trail = [{ name: 'Home', path: '/' }, ...crumbs, { name: page.label ?? page.title, path }];
  const jsonLd = graph(
    webPage(path, webPageOptions),
    // webPage() points `about` at the app unless overridden, so the page defines it (the root layout no longer does).
    ...(webPageOptions?.about ? [] : [softwareApplication()]),
    { ...breadcrumbList(trail), '@id': nodeId(path, 'breadcrumb') },
    articleNode ?? article(path),
    ...schema,
    ...(faqs && faqSchema ? [faqPage(faqs)] : []),
  );
  const bylineExternal = !bylineHref.startsWith('/');

  return (
    <div className={c.page}>
      <JsonLd data={jsonLd} />
      <SiteHeader />

      <main id="main" tabIndex={-1}>
        <article>
          <div className={c.wrap}>
            <nav className={c.crumbs} aria-label="Breadcrumb">
              {trail.slice(0, -1).map((t) => (
                <span key={t.path}>
                  <a href={t.path}>{t.name}</a> <span aria-hidden>/</span>{' '}
                </span>
              ))}
              {trail[trail.length - 1].name}
            </nav>

            <header className={c.head}>
              <h1 className={c.h1}>{h1}</h1>
              <p className={c.byline}>
                By {bylineExternal ? (
                  <a href={bylineHref} target="_blank" rel="noopener noreferrer">{AUTHOR_NAME}</a>
                ) : (
                  <a href={bylineHref}>{AUTHOR_NAME}</a>
                )}
                {showPublished && page.published && (
                  <>
                    {' · Published '}
                    <time dateTime={page.published}>{formatDate(page.published)}</time>
                  </>
                )}
                {' · Updated '}
                <time dateTime={page.updated}>{formatDate(page.updated)}</time>
              </p>
              {meta && <p className={c.byline}>{meta}</p>}
              <p className={c.lede}>{lede}</p>
            </header>
          </div>

          <div className={g.article}>
            {children}

            {faqs && (
              <>
                <h2 className={g.h2} id="faq">Frequently asked questions</h2>
                <div className={g.faqList}>
                  {faqs.map((f, i) => (
                    <details key={f.q} className={g.faqItem} open={i === 0}>
                      <summary className={g.faqQ}>
                        {f.q}
                        <span className={g.faqChevron} aria-hidden>+</span>
                      </summary>
                      <p className={g.faqA}>{f.aNode ?? f.a}</p>
                    </details>
                  ))}
                </div>
              </>
            )}

            {after}
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
