import type { Metadata } from 'next';
import g from '../components/guide.module.css';
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
    <div className={g.page}>
      <SiteHeader />
      <main>
        <section className={g.article}>
          <header className={g.head}>
            <h1 className={g.h1}>404: that page does not exist</h1>
            <p className={g.lede}>
              The link may be old or mistyped. Netflix Ratings is a free extension that shows IMDb
              and Rotten Tomatoes scores on Netflix title cards. Here is where to go next.
            </p>
          </header>

          <p className={g.p}>
            <a className={g.btnPrimary} href="/">Back to the home page</a>
          </p>

          <h2 className={g.h2}>Guides</h2>
          <ul className={g.list}>
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
