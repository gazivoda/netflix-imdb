import c from './site-chrome.module.css';
import { CHROME_WEB_STORE_URL } from '../lib/content';

export default function SiteHeader() {
  return (
    <>
      <nav className={c.nav} aria-label="Primary">
        <a className={c.navLogo} href="/">
          <img className={c.navLogoIcon} src="/icon.svg" alt="" width={34} height={34} />
          Rating Watch
        </a>
        <div className={c.navRight}>
          <a href="/compare/imdb-vs-rotten-tomatoes" className={c.navLink}>IMDb vs Rotten Tomatoes</a>
          <a href={CHROME_WEB_STORE_URL} className={c.navInstall}>Add to Chrome</a>
        </div>
      </nav>
    </>
  );
}
