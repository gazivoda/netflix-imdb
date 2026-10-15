import styles from './Features.module.css';
import shared from './shared.module.css';
import { FEATURES } from '../../lib/content';

export default function Features() {
  return (
    <section className={styles.features} aria-labelledby="features-title">
      <p className={shared.sectionLabel}>Features</p>
      <h2 id="features-title" className={shared.sectionTitle}>
        What can Netflix Ratings do?
      </h2>
      <div className={styles.featureGrid}>
        {FEATURES.map((f) => (
          <article key={f.title} className={styles.featureCard}>
            <div className={styles.featureIcon} aria-hidden>{f.icon}</div>
            <h3 className={styles.featureTitle}>{f.title}</h3>
            <p className={styles.featureDesc}>{f.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
