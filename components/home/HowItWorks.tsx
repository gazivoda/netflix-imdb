import styles from './HowItWorks.module.css';

const STEPS = [
  { n: '1', title: 'Install the extension', desc: 'Load it unpacked from GitHub in a couple of clicks. No store account required.' },
  { n: '2', title: 'Open Netflix', desc: 'Browse like you always do. The extension activates automatically on netflix.com.' },
  { n: '3', title: 'See ratings everywhere', desc: 'IMDb and Rotten Tomatoes scores appear on every card — and on new rows as you scroll.' },
];

export default function HowItWorks() {
  return (
    <section className={styles.howSection} id="how" aria-labelledby="how-title">
      <div className={styles.howInner}>
        <p className={`ds-label ${styles.label}`}>How it works</p>
        <h2 id="how-title" className={`ds-display ${styles.howTitle}`}>
          How does Netflix <em className="ds-serif">Ratings</em> work?
        </h2>
        <p className={styles.howLead}>
          Netflix Ratings reads the title cards on netflix.com, looks up each title&apos;s IMDb
          rating and Rotten Tomatoes score through the OMDb API, and draws a small badge in the
          top-right corner of the card. Setup takes three steps.
        </p>
        <ol className={styles.steps}>
          {STEPS.map((s) => (
            <li key={s.n} className={styles.step}>
              <div className={styles.numRow}>
                <span className={`ds-display ${styles.stepNum}`}>{s.n}</span>
              </div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
