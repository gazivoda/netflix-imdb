import { AR_MODE_NAME } from '../../lib/content';
import styles from './FinalCta.module.css';

export default function FinalCta() {
  return (
    <section className={styles.finalCta} aria-labelledby="cta-title">
      <h2 id="cta-title" className={styles.finalTitle}>Stop opening that second tab.</h2>
      <p className={styles.finalSub}>
        Add IMDb and Rotten Tomatoes to Netflix in about a minute. The extension is a free download
        that you add to Chrome yourself; it is not in the Chrome Web Store yet. Want scores over a
        TV screen too? See <a href="/pricing">{AR_MODE_NAME}</a>.
      </p>
      <a href="/install" className={styles.btn}>
        Download free <span aria-hidden>→</span>
      </a>
    </section>
  );
}
