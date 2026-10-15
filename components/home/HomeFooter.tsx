import styles from './HomeFooter.module.css';
import { pagesInGroup } from '../../lib/pages';
import { REPO_URL, AUTHOR_NAME, LAST_UPDATED, LAST_UPDATED_LABEL } from '../../lib/content';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

export default function HomeFooter() {
  const columns = [
    { title: 'Guides', links: pagesInGroup('guide') },
    { title: 'Compare', links: pagesInGroup('compare') },
    { title: 'About', links: [...pagesInGroup('about'), ...pagesInGroup('legal')] },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.footerLogo}>
          <span className={styles.footerLogoIcon} aria-hidden>★</span>
          <span>Netflix Ratings</span>
        </div>
        <nav className={styles.footerCols} aria-label="Footer">
          {columns.map((col) => (
            <div key={col.title} className={styles.footerCol}>
              <p className={styles.footerColTitle}>{col.title}</p>
              <ul className={styles.footerList}>
                {col.links.map((p) => (
                  <li key={p.path}><a href={p.path}>{p.label ?? p.title}</a></li>
                ))}
              </ul>
            </div>
          ))}
          <div className={styles.footerCol}>
            <p className={styles.footerColTitle}>Project</p>
            <ul className={styles.footerList}>
              <li><a href={REPO_URL} {...external}>GitHub</a></li>
              <li><a href="https://www.omdbapi.com" {...external}>Powered by OMDb</a></li>
            </ul>
          </div>
        </nav>
      </div>
      <hr className={styles.footerPerf} />
      <p className={styles.footerMeta}>
        Built by{' '}
        <a href={REPO_URL} {...external}>{AUTHOR_NAME}</a>
        {' · '}
        Last updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
        {'. '}Independent open-source project, not affiliated with or endorsed by Netflix, IMDb or Rotten Tomatoes.
      </p>
    </footer>
  );
}
