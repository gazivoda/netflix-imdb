import styles from './Testimonials.module.css';
import shared from './shared.module.css';
import { TESTIMONIALS } from '../../lib/content';

export default function Testimonials() {
  return (
    <section className={styles.testimonials} aria-labelledby="loved-title">
      <p className={shared.sectionLabel}>Loved by binge-watchers</p>
      <h2 id="loved-title" className={shared.sectionTitle}>
        People stop guessing &mdash; and start choosing
      </h2>
      <div className={styles.quoteGrid}>
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className={styles.quoteCard}>
            <span className={styles.quoteScore} aria-hidden>{t.rating}</span>
            <blockquote className={styles.quoteText}>&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className={styles.quoteMeta}>
              <span className={styles.quoteAvatar} aria-hidden>{t.name.charAt(0)}</span>
              <span>
                <strong>{t.name}</strong>
                <span className={styles.quoteRole}>{t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
