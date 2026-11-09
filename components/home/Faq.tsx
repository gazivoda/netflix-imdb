import styles from './Faq.module.css';
import shared from './shared.module.css';
import { FAQS, type HomeFaq } from '../../lib/content';

// Same words as the FAQPage JSON-LD answer; the optional link only wraps a phrase inside it.
function renderAnswer({ a, link }: HomeFaq) {
  const at = link ? a.indexOf(link.text) : -1;
  if (!link || at < 0) return a;
  return (
    <>
      {a.slice(0, at)}
      <a href={link.href}>{link.text}</a>
      {a.slice(at + link.text.length)}
    </>
  );
}

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
              <p className={styles.faqA}>{renderAnswer(f)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
