import type { Metadata } from 'next';
import s from './not-found.module.css';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { pagesInGroup } from '../lib/pages';

// A 404 must never be indexed or carry a canonical, so no pageMetadata() here.
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  // Generated from the registry so new guides show up here automatically.
  const pages = [...pagesInGroup('guide'), ...pagesInGroup('compare')];

  return (
    <div className={s.page}>
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        <section className={s.inner}>
          <header className={s.slab}>
            <h1 className={s.h1}>
              <span className={`ds-display ${s.numeral}`}>404</span>
              <span className={s.seat}>
                This seat is <em className="ds-serif">empty.</em>
              </span>
            </h1>
          </header>

          <p className={s.lede}>
            That page does not exist. The link may be old or mistyped. Netflix Ratings is a free
            extension that shows IMDb and Rotten Tomatoes scores on Netflix title cards. Here is
            where to go next.
          </p>

          <div className={s.actions}>
            <a className={`ds-btn ds-btn-signal ${s.bigBtn}`} href="/">Back to the home page</a>
            <a className={`ds-btn ${s.bigBtn}`} href="/install">Install the extension</a>
          </div>

          <h2 className={`ds-display ${s.h2}`}>Guides</h2>
          <ul className={s.rows}>
            <li><a href="/">Home</a></li>
            {pages.map((p) => (
              <li key={p.path}>
                <a href={p.path}>{p.label ?? p.title}</a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
