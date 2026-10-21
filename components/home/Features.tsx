import styles from './Features.module.css';
import { FEATURES } from '../../lib/content';

export default function Features() {
  return (
    <section className={styles.features} aria-labelledby="features-title">
      <p className={`ds-label ${styles.label}`}>Features</p>
      <h2 id="features-title" className={`ds-display ${styles.title}`}>
        What can <em className="ds-serif">Rating Watch</em> do?
      </h2>
      <div className={styles.featureGrid}>
        {FEATURES.map((f) => (
          <article key={f.title} className={`ds-card ${styles.featureCard}`}>
            <div className={styles.stub}>
              <div className={styles.featureIcon} aria-hidden>{f.icon}</div>
            </div>
            {/* Perforation: dashed rule plus two flat notches bitten out of the card edges. */}
            <div className={styles.perf} aria-hidden>
              <span className={`${styles.notch} ${styles.notchL}`} />
              <span className={`${styles.notch} ${styles.notchR}`} />
            </div>
            <div className={styles.body}>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
