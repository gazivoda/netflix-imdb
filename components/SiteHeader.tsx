import c from './site-chrome.module.css';

export default function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <nav className={c.nav} aria-label="Primary">
        <a className={c.navLogo} href="/">
          <span className={c.navLogoIcon} aria-hidden>★</span>
          Rating Watch
        </a>
        <div className={c.navRight}>
          <a href="/compare/imdb-vs-rotten-tomatoes" className={c.navLink}>IMDb vs Rotten Tomatoes</a>
          <a href="/install" className={c.navInstall}>Install</a>
        </div>
      </nav>
    </>
  );
}
