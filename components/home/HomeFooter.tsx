import styles from './HomeFooter.module.css';
import { PAGES } from '../../lib/pages';
import { REPO_URL, AUTHOR_NAME, LAST_UPDATED, LAST_UPDATED_LABEL } from '../../lib/content';

export default function HomeFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerLeft}>
        <span className={styles.footerLogoIcon} style={{ width: 20, height: 20, fontSize: 11 }} aria-hidden>★</span>
        Netflix Ratings
      </div>
      <nav className={styles.footerRight} aria-label="Footer">
        {PAGES.filter((p) => p.group).map((p) => (
          <a key={p.path} href={p.path}>{p.label ?? p.title}</a>
        ))}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">Powered by OMDb</a>
      </nav>
      <p className={styles.footerMeta}>
        Built by{' '}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">{AUTHOR_NAME}</a>
        {' · '}
        Last updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
        {'. '}Independent open-source project, not affiliated with or endorsed by Netflix, IMDb or Rotten Tomatoes.
      </p>
    </footer>
  );
}
