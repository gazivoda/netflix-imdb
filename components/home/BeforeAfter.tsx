import styles from './BeforeAfter.module.css';
import { ImdbChip, RtChip } from '../ScoreChip';

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
            <div className={styles.baArt}>Stranger Things</div>
          </div>
          <p className={styles.baNote}>Great artwork. Zero idea if it&apos;s actually good.</p>
        </div>
        <div className={styles.baVs} aria-hidden>VS</div>
        <div className={styles.baCol}>
          <span className={`${styles.baTag} ${styles.baTagOn}`}>With Netflix Ratings</span>
          <div className={styles.baCard} aria-hidden>
            <div className={styles.baArt}>
              Stranger Things
              <span className={styles.baBadge}>
                <ImdbChip value="8.7" />
                <RtChip value="86%" />
              </span>
            </div>
          </div>
          <p className={styles.baNote}>Audience <strong>8.7</strong>, critics <strong>86%</strong> (illustrative). Press play.</p>
        </div>
      </div>
    </section>
  );
}
