import styles from './HowItWorks.module.css';

const STEPS = [
  { n: '1', title: 'Install the extension', desc: 'Open Rating Watch on the Chrome Web Store, choose Add to Chrome and confirm Add extension. It takes about a minute and needs no Rating Watch account.' },
  { n: '2', title: 'Open Netflix', desc: 'Browse like you always do. The extension activates automatically on netflix.com.' },
  { n: '3', title: 'See ratings everywhere', desc: 'IMDb scores appear on title cards, with Rotten Tomatoes beside them where OMDb has one, and on new rows as you scroll.' },
];

export default function HowItWorks() {
  return (
    <section className={styles.howSection} id="how" aria-labelledby="how-title">
      <div className={styles.howInner}>
        <p className={`ds-label ${styles.label}`}>How it works</p>
        <h2 id="how-title" className={`ds-display ${styles.howTitle}`}>
          How does <em className="ds-serif">Rating Watch</em> work?
        </h2>
        <p className={styles.howLead}>
          Rating Watch reads the title cards on netflix.com, looks up each title&apos;s IMDb
          rating and Rotten Tomatoes score through the OMDb API, and draws a small badge in the
          top-right corner of the card. Setup takes three steps, and the{' '}
          <a href="/how-to/show-imdb-ratings-on-netflix">guide to showing IMDb ratings on Netflix</a>{' '}
          walks through each one.
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
