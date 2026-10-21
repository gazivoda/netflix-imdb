import styles from './HomeNav.module.css';

export default function HomeNav() {
  return (
    <nav className={styles.nav} aria-label="Primary">
      <a className={styles.navLogo} href="/">
        <img className={styles.navLogoIcon} src="/icon.svg" alt="" width={30} height={30} />
        <span>Rating Watch</span>
      </a>
      <div className={styles.navLinks}>
        <a href="/compare/imdb-vs-rotten-tomatoes" className={styles.navLink}>
          IMDb vs Rotten Tomatoes
        </a>
        <a href="#faq" className={styles.navLink}>FAQ</a>
        <a href="/install" className={`ds-btn ds-btn-signal ${styles.navInstall}`}>
          Download free
        </a>
      </div>
    </nav>
  );
}
