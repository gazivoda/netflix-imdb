import styles from './page.module.css';
import { FEATURES, TESTIMONIALS, FAQS, MARQUEE, REPO_URL, AUTHOR_NAME, LAST_UPDATED, LAST_UPDATED_LABEL } from '../lib/content';

const POSTERS = [
  { title: 'Squid Game', imdb: '8.0', rt: '95%', tone: 'red' },
  { title: 'Ozark', imdb: '8.4', rt: '92%', tone: 'teal' },
  { title: 'Wednesday', imdb: '8.1', rt: '67%', tone: 'gold' },
  { title: 'Narcos', imdb: '8.8', rt: '89%', tone: 'paper' },
] as const;

const STEPS = [
  { n: '01', title: 'Install it', desc: 'Load the extension from GitHub in a couple of clicks. No store account required.' },
  { n: '02', title: 'Open Netflix', desc: 'Browse like you always do. It switches on by itself on netflix.com.' },
  { n: '03', title: 'Read the room', desc: 'IMDb and Rotten Tomatoes scores land on every card, including new rows as you scroll.' },
];

export default function Page() {
  return (
    <div className={styles.page}>
      {/* TICKER */}
      <div className={styles.ticker} aria-label="Ratings shown on popular Netflix titles">
        <div className={styles.tickerTrack}>
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={`${m.title}-${i}`} className={styles.tickerItem} aria-hidden={i >= MARQUEE.length}>
              {m.title} <b>★ {m.imdb}</b> <i>{m.rt}</i>
            </span>
          ))}
        </div>
      </div>

      {/* NAV */}
      <nav className={styles.nav}>
        <a className={styles.logo} href="/">
          Netflix<span>/</span>Ratings
        </a>
        <div className={styles.navLinks}>
          <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs RT</a>
          <a href="#how">How</a>
          <a href="#faq">FAQ</a>
          <a href={REPO_URL} className={styles.navCta} target="_blank" rel="noopener noreferrer">
            Get it free →
          </a>
        </div>
      </nav>

      <main>
        {/* HERO */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <div>
            <p className={styles.kicker}>Free Chrome extension · Open source</p>
            <h1 id="hero-title" className={styles.heroTitle}>
              Check the <mark>score.</mark> <em>then</em> press play.
            </h1>
            <p className={styles.heroSub}>
              <strong>IMDb</strong> and <strong>Rotten Tomatoes</strong> ratings, stamped on every
              Netflix title as you scroll. No second tab. No guessing.
            </p>
            <div className={styles.heroCta}>
              <a href={REPO_URL} className={styles.btnPrimary} target="_blank" rel="noopener noreferrer">
                Install free →
              </a>
              <a href="#how" className={styles.textLink}>See how it works</a>
            </div>
          </div>

          <div className={styles.ticketWrap} aria-hidden>
            <div className={styles.ticket}>
              <div className={styles.ticketTop}>
                <p>Admit one · Netflix · Row 02</p>
                <h2>Stranger Things</h2>
              </div>
              <div className={styles.ticketScores}>
                <div className={styles.ticketImdb}>
                  <p>IMDb · audience</p>
                  <strong>8.7</strong>
                </div>
                <div className={styles.ticketRt}>
                  <p>Rotten T. · critics</p>
                  <strong>86<small>%</small></strong>
                </div>
              </div>
              <span className={`${styles.notch} ${styles.notchL}`} />
              <span className={`${styles.notch} ${styles.notchR}`} />
            </div>
          </div>
        </section>

        {/* POSTERS */}
        <section className={styles.posters} aria-label="Example title cards with ratings">
          {POSTERS.map((p) => (
            <div key={p.title} className={`${styles.poster} ${styles[`tone_${p.tone}`]}`}>
              <span className={styles.posterTag}>★ {p.imdb} · {p.rt}</span>
              <span className={styles.posterTitle}>{p.title}</span>
            </div>
          ))}
        </section>

        {/* VERSUS */}
        <section className={styles.versus} aria-labelledby="vs-title">
          <p className={styles.kickerGold}>Two scores, one card</p>
          <h2 id="vs-title" className={styles.srOnly}>IMDb audience score versus Rotten Tomatoes critic score</h2>
          <div className={styles.vsGrid}>
            <div className={styles.vsCol}>
              <p className={styles.vsLabel}>What audiences think</p>
              <p className={`${styles.vsNum} ${styles.vsNumGold}`}>8.7</p>
              <p className={styles.vsText}>Millions of everyday votes on a 10-point scale. Great for gauging how a show lands once the credits roll.</p>
            </div>
            <div className={`${styles.vsCol} ${styles.vsColRight}`}>
              <p className={styles.vsLabel}>What critics think</p>
              <p className={`${styles.vsNum} ${styles.vsNumRed}`}>86%</p>
              <p className={styles.vsText}>The share of professional reviewers who liked it. When the two disagree, that gap is the interesting part.</p>
            </div>
          </div>
          <a href="/compare/imdb-vs-rotten-tomatoes" className={styles.vsLink}>
            Read: IMDb vs Rotten Tomatoes →
          </a>
        </section>

        {/* STORY */}
        <section className={styles.story} aria-labelledby="story-title">
          <div className={styles.storyHead}>
            <p className={styles.kicker}>Why it matters</p>
            <h2 id="story-title" className={styles.h2}>
              A number on the card changes <em>what you pick.</em>
            </h2>
          </div>
          <div className={styles.storyBody}>
            <p>
              The average person spends close to <strong>18 minutes</strong> deciding what to watch
              before giving up or settling for something forgettable. Netflix shows you gorgeous
              artwork and a one-line hook, but never the one number that predicts whether you&apos;ll
              enjoy it. So you open a second tab, search the title, skim a rating, switch back, and
              repeat. Every single time.
            </p>
            <p>
              Netflix Ratings removes that loop. By placing the <strong>IMDb</strong> user score and
              the <strong>Rotten Tomatoes</strong> critic score directly on each title card, the
              decision happens where you already are. You compare audience and critics in one look,
              and press play with confidence, or scroll on without a second thought.
            </p>
            <p>
              Both numbers load in parallel as you browse, so there&apos;s no lag and no
              card-by-card waiting. New rows, search results and &ldquo;More Like This&rdquo;
              suggestions are all covered automatically.
            </p>
          </div>
        </section>

        {/* FEATURES */}
        <section className={styles.features} aria-labelledby="features-title">
          <h2 id="features-title" className={styles.h2}>
            What&apos;s in <em>the box</em>
          </h2>
          <ol className={styles.featureList}>
            {FEATURES.map((f, i) => (
              <li key={f.title} className={styles.featureRow}>
                <span className={styles.rowNum}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* HOW */}
        <section className={styles.how} id="how" aria-labelledby="how-title">
          <h2 id="how-title" className={styles.h2}>
            Up and running <em>in a minute</em>
          </h2>
          <ol className={styles.stepList}>
            {STEPS.map((s) => (
              <li key={s.n} className={styles.stepRow}>
                <span className={styles.rowNum}>{s.n}</span>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.featureDesc}>{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* REVIEWS */}
        <section className={styles.reviews} aria-labelledby="loved-title">
          <h2 id="loved-title" className={styles.h2}>
            People stop guessing, <em>start choosing</em>
          </h2>
          <div className={styles.reviewGrid}>
            {TESTIMONIALS.map((t, i) => (
              <figure key={t.name} className={`${styles.review} ${styles[`rev${i % 4}`]}`}>
                <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption>
                  <strong>{t.name}</strong> · {t.role}
                  <span className={styles.reviewScore}>{t.rating.replace('⭐', '★').replace('🍅', '')}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className={styles.faq} id="faq" aria-labelledby="faq-title">
          <h2 id="faq-title" className={styles.h2}>
            Fine print, <em>in plain words</em>
          </h2>
          <div className={styles.faqList}>
            {FAQS.map((f, i) => (
              <details key={f.q} className={styles.faqItem} open={i === 0}>
                <summary>
                  {f.q}
                  <span aria-hidden>+</span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={styles.finalCta} aria-labelledby="cta-title">
          <h2 id="cta-title">Stop opening that second tab.</h2>
          <a href={REPO_URL} className={styles.btnInk} target="_blank" rel="noopener noreferrer">
            Install free →
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>
          Netflix/Ratings · Built by{' '}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">{AUTHOR_NAME}</a>
          {' · '}
          Updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
        </span>
        <nav aria-label="Footer">
          <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs RT</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">OMDb</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </footer>
    </div>
  );
}
