import { AR_MODE_NAME, CHROME_WEB_STORE_URL } from '../../lib/content';
import styles from './FinalCta.module.css';

export default function FinalCta() {
  return (
    <section className={styles.finalCta} aria-labelledby="cta-title">
      <h2 id="cta-title" className={styles.finalTitle}>Stop opening that second tab.</h2>
      <p className={styles.finalSub}>
        Add IMDb and Rotten Tomatoes to Netflix in about a minute. Install the free extension
        from the Chrome Web Store. Want scores over a
        TV screen too? See <a href="/pricing">{AR_MODE_NAME}</a>.
      </p>
      <a href={CHROME_WEB_STORE_URL} className={styles.btn}>
        Add to Chrome <span aria-hidden>→</span>
      </a>
    </section>
  );
}
