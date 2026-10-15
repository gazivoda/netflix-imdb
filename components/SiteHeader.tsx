import g from './guide.module.css';

export default function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <nav className={g.nav} aria-label="Primary">
        <a className={g.navLogo} href="/">
          <span className={g.navLogoIcon} aria-hidden>★</span>
          Netflix Ratings
        </a>
        <div className={g.navRight}>
          <a href="/compare/imdb-vs-rotten-tomatoes" className={g.navLink}>IMDb vs Rotten Tomatoes</a>
          <a href="/install" className={g.navInstall}>Install</a>
        </div>
      </nav>
    </>
  );
}
