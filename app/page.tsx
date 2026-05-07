import styles from './page.module.css';

const FEATURES = [
  {
    icon: '⭐',
    title: 'Live IMDB Scores',
    desc: 'Every title card shows the current IMDB rating pulled directly from the database — no guessing, no leaving Netflix.',
  },
  {
    icon: '⚡',
    title: 'Instant & Parallel',
    desc: 'All visible cards load ratings simultaneously. Scroll, and the next batch fires automatically. No waiting card by card.',
  },
  {
    icon: '🔒',
    title: 'Privacy First',
    desc: 'No account, no login, no tracking. The extension only talks to the IMDB data source — your watch history stays yours.',
  },
  {
    icon: '🎨',
    title: 'Non-Intrusive Design',
    desc: 'A subtle badge in the corner of each card. Fits Netflix\'s UI perfectly without covering artwork or disrupting browsing.',
  },
  {
    icon: '🔄',
    title: 'Always Up to Date',
    desc: 'Ratings refresh automatically as you browse. New rows, search results, "More Like This" — all covered.',
  },
  {
    icon: '📦',
    title: 'Zero Setup',
    desc: 'Install the extension, open Netflix. That\'s it. No configuration, no API keys, no dashboard to manage.',
  },
];

const CARDS = [
  { label: 'Stranger Things', color: '#1a1a2e', rating: '⭐ 8.7' },
  { label: 'The Crown', color: '#16213e', rating: '⭐ 8.6' },
  { label: 'Squid Game', color: '#1a0a0a', rating: '⭐ 8.0' },
  { label: 'Ozark', color: '#0a1628', rating: '⭐ 8.4' },
];

export default function Page() {
  return (
    <div className={styles.page}>
      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <div className={styles.navLogoIcon}>★</div>
          Netflix IMDB
        </div>
        <a
          href="https://github.com/igorgazivoda/netflix-imdb"
          className={styles.navInstall}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get Extension
        </a>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div>
          <div className={styles.heroBadge}>
            <span>★</span> Free Chrome Extension
          </div>
          <h1 className={styles.heroTitle}>
            Know if it&apos;s worth<br />watching — <span>instantly</span>
          </h1>
          <p className={styles.heroSubtitle}>
            IMDB ratings appear directly on every Netflix title card as you browse.
            No tab-switching, no searching. Just scroll and decide.
          </p>
          <div className={styles.heroCta}>
            <a
              href="https://github.com/igorgazivoda/netflix-imdb"
              className={styles.btnPrimary}
              target="_blank"
              rel="noopener noreferrer"
            >
              ↓ Install Free
            </a>
            <a href="#how-it-works" className={styles.btnSecondary}>
              See how it works →
            </a>
          </div>
          <div className={styles.heroNote}>
            <span>✓</span> Works on all Netflix plans &nbsp;·&nbsp; <span>✓</span> No account needed
          </div>
        </div>

        {/* MOCKUP */}
        <div className={styles.mockupWrap}>
          <div className={styles.mockup}>
            <div className={styles.mockupBar}>
              <div className={`${styles.mockupDot}`} />
              <div className={`${styles.mockupDot}`} />
              <div className={`${styles.mockupDot}`} />
              <div className={styles.mockupUrl}>netflix.com/browse</div>
            </div>

            <div className={styles.netflixBar}>
              <div className={styles.netflixLogo}>NETFLIX</div>
              <div className={styles.netflixNav}>
                <span>Home</span>
                <span>TV Shows</span>
                <span>Movies</span>
                <span>My List</span>
              </div>
            </div>

            <div className={styles.rowLabel}>Continue Watching</div>
            <div className={styles.cardRow}>
              {CARDS.map((c) => (
                <div key={c.label} className={styles.card}>
                  <div className={styles.cardBg} style={{ background: c.color }}>
                    {c.label}
                  </div>
                  <div className={styles.cardBadge}>{c.rating}</div>
                </div>
              ))}
            </div>

            <div className={styles.rowLabel}>Popular on Netflix</div>
            <div className={styles.cardRow}>
              {[
                { label: 'Wednesday', color: '#0d0d1a', rating: '⭐ 8.1' },
                { label: 'The Witcher', color: '#0a1a0a', rating: '⭐ 8.2' },
                { label: 'Bridgerton', color: '#1a0a16', rating: '⭐ 7.3' },
                { label: 'Narcos', color: '#1a1000', rating: '⭐ 8.8' },
              ].map((c) => (
                <div key={c.label} className={styles.card}>
                  <div className={styles.cardBg} style={{ background: c.color }}>
                    {c.label}
                  </div>
                  <div className={styles.cardBadge}>{c.rating}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.glow} />
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.features}>
        <div className={styles.sectionLabel}>Features</div>
        <h2 className={styles.sectionTitle}>Everything you need, nothing you don&apos;t</h2>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <div className={styles.featureTitle}>{f.title}</div>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.howSection} id="how-it-works">
        <div className={styles.howInner}>
          <div className={styles.sectionLabel}>How It Works</div>
          <h2 className={styles.sectionTitle}>Up and running in 60 seconds</h2>
          <div className={styles.steps}>
            {[
              {
                n: '1',
                title: 'Install the extension',
                desc: 'Download from the Chrome Web Store or load unpacked from GitHub. One click.',
              },
              {
                n: '2',
                title: 'Open Netflix',
                desc: 'Browse normally. The extension activates automatically on netflix.com.',
              },
              {
                n: '3',
                title: 'See ratings everywhere',
                desc: 'Every title card shows an IMDB badge. Scroll to load more — they appear instantly.',
              },
            ].map((s) => (
              <div key={s.n} className={styles.step}>
                <div className={styles.stepNum}>{s.n}</div>
                <div className={styles.stepTitle}>{s.title}</div>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INSTALL */}
      <section className={styles.installSection}>
        <h2 className={styles.installTitle}>Install in seconds</h2>
        <p className={styles.installSub}>Load the unpacked extension from GitHub — free forever.</p>
        <div className={styles.installSteps}>
          {[
            {
              i: '1',
              content: (
                <>
                  <strong>Download the repo</strong> — clone or download the ZIP from{' '}
                  <code>github.com/igorgazivoda/netflix-imdb</code>
                </>
              ),
            },
            {
              i: '2',
              content: (
                <>
                  Open Chrome and go to <code>chrome://extensions</code>, then enable{' '}
                  <strong>Developer mode</strong> (top-right toggle)
                </>
              ),
            },
            {
              i: '3',
              content: (
                <>
                  Click <strong>Load unpacked</strong> and select the <code>extension/</code>{' '}
                  folder from the downloaded repo
                </>
              ),
            },
            {
              i: '4',
              content: (
                <>
                  Navigate to <strong>netflix.com</strong> — ratings will appear on every title card
                  automatically
                </>
              ),
            },
          ].map((s) => (
            <div key={s.i} className={styles.installStep}>
              <div className={styles.installIdx}>{s.i}</div>
              <div className={styles.installText}>{s.content}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <div className={styles.navLogoIcon} style={{ width: 20, height: 20, fontSize: 11 }}>★</div>
          Netflix IMDB Ratings
        </div>
        <div className={styles.footerRight}>
          <a
            href="https://github.com/igorgazivoda/netflix-imdb"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://www.omdbapi.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by OMDb
          </a>
          <a href="/privacy">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
