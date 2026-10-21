import styles from './BeforeAfter.module.css';
import { ImdbChip, RtChip } from '../ScoreChip';
import { SHOWCASE } from '../../lib/content';

const EXAMPLE = 'Roma';
const SCORES = SHOWCASE[EXAMPLE];

export default function BeforeAfter() {
  return (
    <section className={styles.beforeAfter} aria-labelledby="ba-title">
      <p className={styles.baLabel}>Before &amp; after</p>
      <h2 id="ba-title" className={styles.baTitle}>
        What changes on a Netflix card with the <em>extension</em>?
      </h2>
      <div className={styles.baGrid}>
        <div className={styles.baCol}>
          <span className={`${styles.baTag} ${styles.baTagOff}`}>Without the extension</span>
          <div className={styles.baCard} aria-hidden>
            <div className={styles.baArt}>{EXAMPLE}</div>
          </div>
          <p className={styles.baNote}>Great artwork. Zero idea if it&apos;s actually good.</p>
        </div>
        <div className={styles.baVs} aria-hidden>VS</div>
        <div className={styles.baCol}>
          <span className={`${styles.baTag} ${styles.baTagOn}`}>With Rating Watch</span>
          <div className={styles.baCard} aria-hidden>
            <div className={styles.baArt}>
              {EXAMPLE}
              <span className={styles.baBadge}>
                <ImdbChip value={SCORES.imdb} />
                <RtChip value={SCORES.rt!} />
              </span>
            </div>
          </div>
          <p className={styles.baNote}>Audience <strong>{SCORES.imdb}</strong>, critics <strong>{SCORES.rt}</strong> (illustrative). Press play.</p>
        </div>
      </div>
    </section>
  );
}
