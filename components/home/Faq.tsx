import styles from './Faq.module.css';
import shared from './shared.module.css';
import { FAQS } from '../../lib/content';

export default function Faq() {
  return (
    <section className={styles.faqSection} id="faq" aria-labelledby="faq-title">
      <div className={styles.faqInner}>
        <p className={shared.sectionLabel}>FAQ</p>
        <h2 id="faq-title" className={shared.sectionTitle}>Questions, answered</h2>
        <div className={styles.faqList}>
          {FAQS.map((f, i) => (
            <details key={f.q} className={styles.faqItem} open={i === 0}>
              <summary className={styles.faqQ}>
                {f.q}
                <span className={styles.faqChevron} aria-hidden>+</span>
              </summary>
              <p className={styles.faqA}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
