import styles from './CompareCta.module.css';
import { ImdbChip, RtChip } from '../ScoreChip';
import { SHOWCASE } from '../../lib/content';

const EXAMPLE = 'Roma';
const SCORES = SHOWCASE[EXAMPLE];
const pct = (v: string) => `${Math.round(parseFloat(v) * (v.endsWith('%') ? 1 : 10))}%`;

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
          They often disagree, and that gap is exactly what helps you pick. In our{' '}
          <a href="/research/imdb-vs-rotten-tomatoes-gap">data study of 44 Netflix films</a> the two
          scores differed by 18.7 points on average. We also break down how the two systems work
          and when to trust each.
        </p>
        <a href="/compare/imdb-vs-rotten-tomatoes" className={`ds-btn ${styles.btnGhost}`}>
          Read: IMDb vs Rotten Tomatoes <span aria-hidden>→</span>
        </a>
      </div>
      <div className={styles.scoreboard}>
        <div className={styles.board}>
          <div className={`${styles.cell} ${styles.cellImdb}`}>
            <span className={styles.dialName}><ImdbChip value={SCORES.imdb} text="IMDb" /></span>
            <span className={styles.dialNum}>{SCORES.imdb}</span>
            <span className={styles.dialBarTrack}><span className={styles.dialBarImdb} style={{ width: pct(SCORES.imdb) }} /></span>
          </div>
          <div className={`${styles.cell} ${styles.cellRt}`}>
            <span className={styles.dialName}><RtChip value={SCORES.rt!} text="RT" /></span>
            <span className={styles.dialNum}>{SCORES.rt}</span>
            <span className={styles.dialBarTrack}><span className={styles.dialBarRt} style={{ width: pct(SCORES.rt!) }} /></span>
          </div>
        </div>
        <div className={styles.dialCaption}>Illustrative example: Roma (film)</div>
      </div>
    </section>
  );
}
