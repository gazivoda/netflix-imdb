import styles from './CompareCta.module.css';
import { ImdbChip, RtChip } from '../ScoreChip';

export default function CompareCta() {
  return (
    <section className={styles.compareCta} aria-labelledby="compare-title">
      <div>
        <p className={`ds-label ${styles.label}`}>Two scores, one card</p>
        <h2 id="compare-title" className={`ds-display ${styles.compareTitle}`}>
          IMDb tells you what audiences think. Rotten Tomatoes tells you what{' '}
          <em className="ds-serif">critics</em> think.
        </h2>
        <p className={styles.compareDesc}>
          They often disagree — and that gap is exactly what helps you pick. We break down how
          the two systems work and when to trust each.
        </p>
        <a href="/compare/imdb-vs-rotten-tomatoes" className={`ds-btn ${styles.btnGhost}`}>
          Read: IMDb vs Rotten Tomatoes <span aria-hidden>→</span>
        </a>
      </div>
      <div className={styles.scoreboard}>
        <div className={styles.board}>
          <div className={`${styles.cell} ${styles.cellImdb}`}>
            <span className={styles.dialName}><ImdbChip value="8.7" text="IMDb" /></span>
            <span className={styles.dialNum}>8.7</span>
            <span className={styles.dialBarTrack}><span className={styles.dialBarImdb} style={{ width: '87%' }} /></span>
          </div>
          <div className={`${styles.cell} ${styles.cellRt}`}>
            <span className={styles.dialName}><RtChip value="86%" text="RT" /></span>
            <span className={styles.dialNum}>86%</span>
            <span className={styles.dialBarTrack}><span className={styles.dialBarRt} style={{ width: '86%' }} /></span>
          </div>
        </div>
        <div className={styles.dialCaption}>Illustrative example: Stranger Things</div>
      </div>
    </section>
  );
}
