import styles from './Hero.module.css';
import shared from './shared.module.css';
import { ImdbChip, RtChip } from '../ScoreChip';
import { CHROME_WEB_STORE_URL, SHOWCASE } from '../../lib/content';

// Scores come from the shared SHOWCASE table so one title never shows two different numbers.
// Stranger Things is a series: like the real extension, its card shows IMDb only.
const CARDS = [
  { label: 'Roma', color: '#241a2e' },
  { label: 'The Irishman', color: '#16213e' },
  { label: 'Klaus', color: '#2a0f0f' },
  { label: 'Stranger Things', color: '#0a1f2e' },
];

const CARDS2 = [
  { label: 'Enola Holmes', color: '#16162a' },
  { label: 'Extraction', color: '#10240f' },
  { label: 'Bird Box', color: '#2a0f24' },
  { label: 'Red Notice', color: '#2a1d00' },
];

function ScoreBadge({ title }: { title: string }) {
  const { imdb, rt } = SHOWCASE[title];
  return (
    <div className={styles.cardBadge}>
      <ImdbChip value={imdb} />
      {rt && <RtChip value={rt} />}
    </div>
  );
}

export default function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroHead}>
        <div className={`${styles.heroBadge} ${shared.reveal}`}>
          <span aria-hidden>★</span> Free Chrome extension
        </div>
        <h1 id="hero-title" className={`${styles.heroTitle} ${shared.reveal} ${shared.d1}`}>
          Know if it&apos;s worth watching <em>before</em> you press play.
        </h1>
      </div>

      <div className={styles.heroCopy}>
        <p className={`${styles.heroSubtitle} ${shared.reveal} ${shared.d2}`}>
          Rating Watch is a free Chrome extension that shows the{' '}
          <strong>IMDb</strong> rating on Netflix title cards as you browse, plus the{' '}
          <strong>Rotten Tomatoes</strong> score where one exists (mostly films).
          {' '}The extension needs no account, no second tab, no searching. Just scroll and decide.
        </p>
        <div className={`${styles.heroCta} ${shared.reveal} ${shared.d3}`}>
          <a href={CHROME_WEB_STORE_URL} className="ds-btn ds-btn-signal">
            Add to Chrome <span aria-hidden>→</span>
          </a>
          <a href="#how" className={`ds-btn ${styles.btnSecondary}`}>
            See how it works
          </a>
        </div>
        <ul className={`${styles.heroNote} ${shared.reveal} ${shared.d4}`}>
          <li>Free on the Chrome Web Store</li>
          <li>Chrome, Edge &amp; Brave</li>
          <li>Extension needs no account</li>
        </ul>
      </div>

      {/* MOCKUP */}
      <div className={`${styles.mockupWrap} ${shared.reveal} ${shared.d2}`}>
        <div className={styles.mockupStage}>
          <div
            className={styles.mockup}
            role="img"
            aria-label="Illustration of the Netflix browse page with an IMDb rating and, for films, a Rotten Tomatoes score badge in the corner of each title card. Scores shown are illustrative."
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
                  <ScoreBadge title={c.label} />
                </div>
              ))}
            </div>

            <div className={styles.rowLabel} aria-hidden>Popular on Netflix</div>
            <div className={styles.cardRow} aria-hidden>
              {CARDS2.map((c) => (
                <div key={c.label} className={styles.card}>
                  <div className={styles.cardBg} style={{ background: c.color }}>{c.label}</div>
                  <ScoreBadge title={c.label} />
                </div>
              ))}
            </div>
          </div>
          <div className={styles.glow} aria-hidden />
        </div>
        <p className={styles.illustrative}>Illustrative scores. The extension fetches real ratings as you browse. TV series usually show IMDb only.</p>
      </div>
    </section>
  );
}
