import styles from './FinalCta.module.css';

export default function FinalCta() {
  return (
    <section className={styles.finalCta} aria-labelledby="cta-title">
      <h2 id="cta-title" className={styles.finalTitle}>Stop opening that second tab.</h2>
      <p className={styles.finalSub}>Add IMDb and Rotten Tomatoes to Netflix in under a minute. The extension is free.</p>
      <a href="/install" className={styles.btn}>
        Install free <span aria-hidden>→</span>
      </a>
    </section>
  );
}
