import type { ReactNode } from 'react';
import g from './guide.module.css';
import JsonLd from './JsonLd';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import { getPage } from '../lib/pages';
import { AUTHOR_NAME, REPO_URL } from '../lib/content';
import { article, breadcrumbList, faqPage, graph, nodeId, webPage } from '../lib/seo';

export interface Faq { q: string; a: string }

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/**
 * Shared shell for every content page: header, breadcrumb, byline with a real
 * updated date, JSON-LD graph (Breadcrumb + Article [+ extras] [+ FAQ]) and the
 * registry-driven footer. Page copy goes in children.
 */
export default function GuideLayout({
  path,
  h1,
  lede,
  children,
  faqs,
  schema = [],
  crumbs = [],
}: {
  path: string;
  h1: string;
  lede: ReactNode;
  children: ReactNode;
  faqs?: Faq[];
  schema?: Record<string, unknown>[];
  /** Intermediate breadcrumb steps between Home and this page. */
  crumbs?: { name: string; path: string }[];
}) {
  const page = getPage(path);
  const trail = [{ name: 'Home', path: '/' }, ...crumbs, { name: page.label ?? page.title, path }];
  const jsonLd = graph(webPage(path), { ...breadcrumbList(trail), '@id': nodeId(path, 'breadcrumb') }, article(path), ...schema, ...(faqs ? [faqPage(faqs)] : []));

  return (
    <div className={g.page}>
      <JsonLd data={jsonLd} />
      <SiteHeader />

      <main id="main" tabIndex={-1}>
        <article className={g.article}>
          <nav className={g.crumbs} aria-label="Breadcrumb">
            {trail.slice(0, -1).map((t) => (
              <span key={t.path}>
                <a href={t.path}>{t.name}</a> <span aria-hidden>/</span>{' '}
              </span>
            ))}
            {trail[trail.length - 1].name}
          </nav>

          <header className={g.head}>
            <h1 className={g.h1}>{h1}</h1>
            <p className={g.byline}>
              By <a href={REPO_URL} target="_blank" rel="noopener noreferrer">{AUTHOR_NAME}</a>
              {' · Updated '}
              <time dateTime={page.updated}>{formatDate(page.updated)}</time>
            </p>
            <p className={g.lede}>{lede}</p>
          </header>

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
                    <p className={g.faqA}>{f.a}</p>
                  </details>
                ))}
              </div>
            </>
          )}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
