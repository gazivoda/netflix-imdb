import styles from './HomeFooter.module.css';
import { pagesInGroup } from '../../lib/pages';
import { AUTHOR_NAME, LAST_UPDATED, LAST_UPDATED_LABEL } from '../../lib/content';
import CookieSettings from '../CookieSettings';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

export default function HomeFooter() {
  const columns = [
    { title: 'Guides', links: pagesInGroup('guide') },
    { title: 'Compare', links: pagesInGroup('compare') },
    { title: 'About', links: [...pagesInGroup('about'), ...pagesInGroup('legal')], cookieSettings: true },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.footerLogo}>
          <img className={styles.footerLogoIcon} src="/icon.svg" alt="" width={30} height={30} />
          <span>Rating Watch</span>
        </div>
        <nav className={styles.footerCols} aria-label="Footer">
          {columns.map((col) => (
            <div key={col.title} className={styles.footerCol}>
              <p className={styles.footerColTitle}>{col.title}</p>
              <ul className={styles.footerList}>
                {col.links.map((p) => (
                  <li key={p.path}><a href={p.path}>{p.label ?? p.title}</a></li>
                ))}
                {col.cookieSettings && <li><CookieSettings /></li>}
              </ul>
            </div>
          ))}
          <div className={styles.footerCol}>
            <p className={styles.footerColTitle}>Project</p>
            <ul className={styles.footerList}>
              <li><a href="https://www.omdbapi.com" {...external}>Powered by OMDb</a></li>
            </ul>
          </div>
        </nav>
      </div>
      <hr className={styles.footerPerf} />
      <p className={styles.footerMeta}>
        Built by{' '}
        <a href="/about">{AUTHOR_NAME}</a>
        {' · '}
        Last updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
        {'. '}Independent project, not affiliated with or endorsed by Netflix, IMDb or Rotten Tomatoes.
      </p>
    </footer>
  );
}
