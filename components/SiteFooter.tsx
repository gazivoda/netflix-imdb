import g from './guide.module.css';
import { PAGES, pagesInGroup } from '../lib/pages';
import { REPO_URL, AUTHOR_NAME } from '../lib/content';

// Links are generated from the page registry, so every registered guide is
// linked sitewide and can never become an orphan.
export default function SiteFooter({ updated }: { updated?: { iso: string; label: string } }) {
  const guides = pagesInGroup('guide');
  const compare = pagesInGroup('compare');
  const about = pagesInGroup('about');
  const legal = pagesInGroup('legal');
  const home = PAGES.find((p) => p.path === '/');

  return (
    <footer className={g.footer}>
      <div className={g.footerCols}>
        <nav className={g.footerCol} aria-label="Guides">
          <span className={g.footerHead}>Guides</span>
          {guides.map((p) => (
            <a key={p.path} href={p.path}>{p.label ?? p.title}</a>
          ))}
          {compare.map((p) => (
            <a key={p.path} href={p.path}>{p.label ?? p.title}</a>
          ))}
        </nav>
        <nav className={g.footerCol} aria-label="Project">
          <span className={g.footerHead}>Project</span>
          {home && <a href={home.path}>Home</a>}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub (open source)</a>
          <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">Powered by OMDb</a>
          {about.map((p) => (
            <a key={p.path} href={p.path}>{p.label ?? p.title}</a>
          ))}
          {legal.map((p) => (
            <a key={p.path} href={p.path}>{p.label ?? p.title}</a>
          ))}
        </nav>
      </div>
      <p className={g.footerMeta}>
        Built by <a href={REPO_URL} target="_blank" rel="noopener noreferrer">{AUTHOR_NAME}</a>
        {updated && (
          <>
            {' · '}Updated <time dateTime={updated.iso}>{updated.label}</time>
          </>
        )}
        {'. '}Netflix Ratings is an independent open-source project. It is not affiliated with or
        endorsed by Netflix, IMDb or Rotten Tomatoes; those names belong to their owners.
      </p>
    </footer>
  );
}
