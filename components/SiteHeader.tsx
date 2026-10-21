import c from './site-chrome.module.css';

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
          <a href="/install" className={c.navInstall}>Install</a>
        </div>
      </nav>
    </>
  );
}
