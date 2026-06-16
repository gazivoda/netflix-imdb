import styles from './page.module.css';
import { FEATURES, STATS, TESTIMONIALS, FAQS, MARQUEE, REPO_URL } from '../lib/content';

const CARDS = [
  { label: 'Stranger Things', color: '#241a2e', imdb: '8.7', rt: '86%' },
  { label: 'The Crown', color: '#16213e', imdb: '8.6', rt: '80%' },
  { label: 'Squid Game', color: '#2a0f0f', imdb: '8.0', rt: '95%' },
  { label: 'Ozark', color: '#0a1f2e', imdb: '8.4', rt: '92%' },
];

const CARDS2 = [
  { label: 'Wednesday', color: '#16162a', imdb: '8.1', rt: '67%' },
  { label: 'The Witcher', color: '#10240f', imdb: '8.2', rt: '82%' },
  { label: 'Bridgerton', color: '#2a0f24', imdb: '7.3', rt: '69%' },
  { label: 'Narcos', color: '#2a1d00', imdb: '8.8', rt: '89%' },
];

function ScoreBadge({ imdb, rt }: { imdb: string; rt: string }) {
  return (
    <div className={styles.cardBadge}>
      <span className={styles.imdbChip}>★ {imdb}</span>
      <span className={styles.rtChip}>🍅 {rt}</span>
    </div>
  );
}

export default function Page() {
  return (
    <div className={styles.page}>
      {/* NAV */}
      <nav className={styles.nav}>
        <a className={styles.navLogo} href="/">
          <span className={styles.navLogoIcon} aria-hidden>★</span>
          Netflix Ratings
        </a>
        <div className={styles.navLinks}>
          <a href="/compare/imdb-vs-rotten-tomatoes" className={styles.navLink}>
            IMDb vs Rotten Tomatoes
          </a>
          <a href="#faq" className={styles.navLink}>FAQ</a>
          <a href={REPO_URL} className={styles.navInstall} target="_blank" rel="noopener noreferrer">
            Get the extension
          </a>
        </div>
      </nav>

      <main>
        {/* HERO */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <div className={`${styles.heroBadge} ${styles.reveal}`}>
              <span aria-hidden>★</span> Free open-source Chrome extension
            </div>
            <h1 id="hero-title" className={`${styles.heroTitle} ${styles.reveal} ${styles.d1}`}>
              Know if it&apos;s worth watching <em>before</em> you press play.
            </h1>
            <p className={`${styles.heroSubtitle} ${styles.reveal} ${styles.d2}`}>
              Netflix Ratings drops the <strong>IMDb</strong> and <strong>Rotten Tomatoes</strong>{' '}
              score onto every title card as you browse. No second tab, no searching — just scroll
              and decide.
            </p>
            <div className={`${styles.heroCta} ${styles.reveal} ${styles.d3}`}>
              <a href={REPO_URL} className={styles.btnPrimary} target="_blank" rel="noopener noreferrer">
                Install free <span aria-hidden>→</span>
              </a>
              <a href="#how" className={styles.btnSecondary}>
                See how it works
              </a>
            </div>
            <ul className={`${styles.heroNote} ${styles.reveal} ${styles.d4}`}>
              <li>IMDb + Rotten Tomatoes</li>
              <li>Works on every plan</li>
              <li>No account needed</li>
            </ul>
          </div>

          {/* MOCKUP */}
          <div className={`${styles.mockupWrap} ${styles.reveal} ${styles.d2}`}>
            <div className={styles.mockup}>
              <div className={styles.mockupBar}>
                <span className={styles.mockupDot} />
                <span className={styles.mockupDot} />
                <span className={styles.mockupDot} />
                <span className={styles.mockupUrl}>netflix.com/browse</span>
              </div>
              <div className={styles.netflixBar}>
                <span className={styles.netflixLogo}>NETFLIX</span>
                <div className={styles.netflixNav}>
                  <span>Home</span><span>TV Shows</span><span>Movies</span><span>My List</span>
                </div>
              </div>

              <div className={styles.rowLabel}>Continue Watching</div>
              <div className={styles.cardRow}>
                {CARDS.map((c) => (
                  <div key={c.label} className={styles.card}>
                    <div className={styles.cardBg} style={{ background: c.color }}>{c.label}</div>
                    <ScoreBadge imdb={c.imdb} rt={c.rt} />
                  </div>
                ))}
              </div>

              <div className={styles.rowLabel}>Popular on Netflix</div>
              <div className={styles.cardRow}>
                {CARDS2.map((c) => (
                  <div key={c.label} className={styles.card}>
                    <div className={styles.cardBg} style={{ background: c.color }}>{c.label}</div>
                    <ScoreBadge imdb={c.imdb} rt={c.rt} />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.glow} aria-hidden />
          </div>
        </section>

        {/* STATS */}
        <section className={styles.stats} aria-label="At a glance">
          {STATS.map((s) => (
            <div key={s.label} className={styles.stat}>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statSub}>{s.sub}</div>
            </div>
          ))}
        </section>

        {/* MARQUEE */}
        <section className={styles.marquee} aria-label="Ratings shown on popular Netflix titles">
          <div className={styles.marqueeTrack}>
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={`${m.title}-${i}`} className={styles.marqueeItem} aria-hidden={i >= MARQUEE.length}>
                <span className={styles.marqueeTitle}>{m.title}</span>
                <span className={styles.marqueeImdb}>★ {m.imdb}</span>
                <span className={styles.marqueeRt}>🍅 {m.rt}</span>
              </span>
            ))}
          </div>
        </section>

        {/* NARRATIVE */}
        <section className={styles.story} aria-labelledby="story-title">
          <div className={styles.storyHead}>
            <p className={styles.sectionLabel}>Why it matters</p>
            <h2 id="story-title" className={styles.storyTitle}>
              A rating on the card changes how you choose what to watch.
            </h2>
          </div>
          <div className={styles.storyBody}>
            <p>
              The average person spends close to <strong>18 minutes</strong> deciding what to watch
              before giving up or settling for something forgettable. Netflix shows you gorgeous
              artwork and a one-line hook — but never the one number that actually predicts whether
              you&apos;ll enjoy it. So you open a second tab, search the title, skim a rating, switch
              back, and repeat. Every single time.
            </p>
            <p>
              Netflix Ratings removes that loop entirely. By placing the <strong>IMDb</strong> user
              score and the <strong>Rotten Tomatoes</strong> critic score directly on each title
              card, the decision happens where you already are. You glance, you compare the audience
              and the critics in the same look, and you press play with confidence — or scroll on
              without a second thought.
            </p>
            <p>
              Because both numbers load in parallel as you browse, there&apos;s no lag and no
              card-by-card waiting. New rows, search results and &ldquo;More Like This&rdquo;
              suggestions are all covered automatically. It&apos;s the context Netflix should have
              shipped years ago — quietly added back in.
            </p>
            <blockquote className={styles.pullQuote}>
              &ldquo;Two trusted scores, on every card, in the time it takes to scroll.&rdquo;
            </blockquote>
          </div>
        </section>

        {/* BEFORE / AFTER */}
        <section className={styles.beforeAfter} aria-labelledby="ba-title">
          <p className={styles.sectionLabel}>Before &amp; after</p>
          <h2 id="ba-title" className={styles.sectionTitle}>The same card, two very different decisions</h2>
          <div className={styles.baGrid}>
            <div className={styles.baCol}>
              <span className={`${styles.baTag} ${styles.baTagOff}`}>Without the extension</span>
              <div className={styles.baCard}>
                <div className={styles.baArt} style={{ background: '#241a2e' }}>Stranger Things</div>
              </div>
              <p className={styles.baNote}>Great artwork. Zero idea if it&apos;s actually good.</p>
            </div>
            <div className={styles.baCol}>
              <span className={`${styles.baTag} ${styles.baTagOn}`}>With Netflix Ratings</span>
              <div className={styles.baCard}>
                <div className={styles.baArt} style={{ background: '#241a2e' }}>
                  Stranger Things
                  <span className={styles.baBadge}>
                    <span className={styles.imdbChip}>★ 8.7</span>
                    <span className={styles.rtChip}>🍅 86%</span>
                  </span>
                </div>
              </div>
              <p className={styles.baNote}>Audience <strong>8.7</strong>, critics <strong>86%</strong>. Press play.</p>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className={styles.features} aria-labelledby="features-title">
          <p className={styles.sectionLabel}>Features</p>
          <h2 id="features-title" className={styles.sectionTitle}>
            Everything you need, nothing you don&apos;t
          </h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <article key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon} aria-hidden>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={styles.howSection} id="how" aria-labelledby="how-title">
          <div className={styles.howInner}>
            <p className={styles.sectionLabel}>How it works</p>
            <h2 id="how-title" className={styles.sectionTitle}>Up and running in 60 seconds</h2>
            <ol className={styles.steps}>
              {[
                { n: '1', title: 'Install the extension', desc: 'Load it unpacked from GitHub in a couple of clicks. No store account required.' },
                { n: '2', title: 'Open Netflix', desc: 'Browse like you always do. The extension activates automatically on netflix.com.' },
                { n: '3', title: 'See ratings everywhere', desc: 'IMDb and Rotten Tomatoes scores appear on every card — and on new rows as you scroll.' },
              ].map((s) => (
                <li key={s.n} className={styles.step}>
                  <span className={styles.stepNum}>{s.n}</span>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepDesc}>{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className={styles.testimonials} aria-labelledby="loved-title">
          <p className={styles.sectionLabel}>Loved by binge-watchers</p>
          <h2 id="loved-title" className={styles.sectionTitle}>
            People stop guessing &mdash; and start choosing
          </h2>
          <div className={styles.quoteGrid}>
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className={styles.quoteCard}>
                <span className={styles.quoteScore} aria-hidden>{t.rating}</span>
                <blockquote className={styles.quoteText}>&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className={styles.quoteMeta}>
                  <span className={styles.quoteAvatar} aria-hidden>{t.name.charAt(0)}</span>
                  <span>
                    <strong>{t.name}</strong>
                    <span className={styles.quoteRole}>{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* COMPARE CTA */}
        <section className={styles.compareCta} aria-labelledby="compare-title">
          <div>
            <p className={styles.sectionLabel}>Two scores, one card</p>
            <h2 id="compare-title" className={styles.compareTitle}>
              IMDb tells you what audiences think. Rotten Tomatoes tells you what critics think.
            </h2>
            <p className={styles.compareDesc}>
              They often disagree — and that gap is exactly what helps you pick. We break down how
              the two systems work and when to trust each.
            </p>
            <a href="/compare/imdb-vs-rotten-tomatoes" className={styles.btnGhost}>
              Read: IMDb vs Rotten Tomatoes <span aria-hidden>→</span>
            </a>
          </div>
          <div className={styles.compareDial}>
            <div className={styles.dialRow}>
              <span className={styles.dialName}>★ IMDb</span>
              <span className={styles.dialBarTrack}><span className={styles.dialBarImdb} style={{ width: '87%' }} /></span>
              <span className={styles.dialNum}>8.7</span>
            </div>
            <div className={styles.dialRow}>
              <span className={styles.dialName}>🍅 RT</span>
              <span className={styles.dialBarTrack}><span className={styles.dialBarRt} style={{ width: '86%' }} /></span>
              <span className={styles.dialNum}>86%</span>
            </div>
            <div className={styles.dialCaption}>Stranger Things, as shown on your Netflix cards</div>
          </div>
        </section>

        {/* FAQ */}
        <section className={styles.faqSection} id="faq" aria-labelledby="faq-title">
          <div className={styles.faqInner}>
            <p className={styles.sectionLabel}>FAQ</p>
            <h2 id="faq-title" className={styles.sectionTitle}>Questions, answered</h2>
            <div className={styles.faqList}>
              {FAQS.map((f, i) => (
                <details key={f.q} className={styles.faqItem} open={i === 0}>
                  <summary className={styles.faqQ}>
                    {f.q}
                    <span className={styles.faqChevron} aria-hidden>+</span>
                  </summary>
                  <p className={styles.faqA}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={styles.finalCta} aria-labelledby="cta-title">
          <h2 id="cta-title" className={styles.finalTitle}>Stop opening that second tab.</h2>
          <p className={styles.finalSub}>Add IMDb and Rotten Tomatoes to Netflix in under a minute — free, forever.</p>
          <a href={REPO_URL} className={styles.btnPrimary} target="_blank" rel="noopener noreferrer">
            Install free <span aria-hidden>→</span>
          </a>
        </section>
      </main>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.navLogoIcon} style={{ width: 20, height: 20, fontSize: 11 }} aria-hidden>★</span>
          Netflix Ratings
        </div>
        <nav className={styles.footerRight} aria-label="Footer">
          <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">Powered by OMDb</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </footer>
    </div>
  );
}
