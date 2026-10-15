import styles from './Hero.module.css';
import shared from './shared.module.css';
import { ImdbChip, RtChip } from '../ScoreChip';

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
      <ImdbChip value={imdb} />
      <RtChip value={rt} />
    </div>
  );
}

export default function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroHead}>
        <div className={`${styles.heroBadge} ${shared.reveal}`}>
          <span aria-hidden>★</span> Free open-source Chrome extension
        </div>
        <h1 id="hero-title" className={`${styles.heroTitle} ${shared.reveal} ${shared.d1}`}>
          Know if it&apos;s worth watching <em>before</em> you press play.
        </h1>
      </div>

      <div className={styles.heroCopy}>
        <p className={`${styles.heroSubtitle} ${shared.reveal} ${shared.d2}`}>
          Netflix Ratings is a free, open-source Chrome extension that shows the{' '}
          <strong>IMDb</strong> rating and the <strong>Rotten Tomatoes</strong> score on every
          Netflix title card as you browse. No account, no second tab, no searching — just
          scroll and decide.
        </p>
        <div className={`${styles.heroCta} ${shared.reveal} ${shared.d3}`}>
          <a href="/install" className="ds-btn ds-btn-signal">
            Install free <span aria-hidden>→</span>
          </a>
          <a href="#how" className={`ds-btn ${styles.btnSecondary}`}>
            See how it works
          </a>
        </div>
        <ul className={`${styles.heroNote} ${shared.reveal} ${shared.d4}`}>
          <li>IMDb + Rotten Tomatoes</li>
          <li>Chrome, Edge &amp; Brave</li>
          <li>No account needed</li>
        </ul>
      </div>

      {/* MOCKUP */}
      <div className={`${styles.mockupWrap} ${shared.reveal} ${shared.d2}`}>
        <div className={styles.mockupStage}>
          <div
            className={styles.mockup}
            role="img"
            aria-label="Illustration of the Netflix browse page with an IMDb rating and a Rotten Tomatoes score badge in the corner of each title card. Scores shown are illustrative."
          >
            <div className={styles.mockupBar} aria-hidden>
              <span className={styles.mockupDot} />
              <span className={styles.mockupDot} />
              <span className={styles.mockupDot} />
              <span className={styles.mockupUrl}>netflix.com/browse</span>
            </div>
            <div className={styles.netflixBar} aria-hidden>
              <span className={styles.netflixLogo}>NETFLIX</span>
              <div className={styles.netflixNav}>
                <span>Home</span><span>TV Shows</span><span>Movies</span><span>My List</span>
              </div>
            </div>

            <div className={styles.rowLabel} aria-hidden>Continue Watching</div>
            <div className={styles.cardRow} aria-hidden>
              {CARDS.map((c) => (
                <div key={c.label} className={styles.card}>
                  <div className={styles.cardBg} style={{ background: c.color }}>{c.label}</div>
                  <ScoreBadge imdb={c.imdb} rt={c.rt} />
                </div>
              ))}
            </div>

            <div className={styles.rowLabel} aria-hidden>Popular on Netflix</div>
            <div className={styles.cardRow} aria-hidden>
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
        <p className={styles.illustrative}>Illustrative scores. The extension fetches real ratings as you browse.</p>
      </div>
    </section>
  );
}
