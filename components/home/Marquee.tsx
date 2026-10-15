import styles from './Marquee.module.css';
import { ImdbChip, RtChip } from '../ScoreChip';
import { MARQUEE } from '../../lib/content';

export default function Marquee() {
  return (
    <>
      <section className={styles.marquee} aria-hidden>
        <div className={styles.marqueeTrack}>
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={`${m.title}-${i}`} className={`${styles.marqueeItem}${i >= MARQUEE.length ? ` ${styles.marqueeDup}` : ''}`}>
              <span className={styles.marqueeTitle}>{m.title}</span>
              <span className={styles.marqueeScores}>
                <ImdbChip value={m.imdb} />
                <RtChip value={m.rt} />
              </span>
            </span>
          ))}
        </div>
      </section>
      <p className={`${styles.marqueeCaption} ds-label`}>Illustrative scores, for demonstration only.</p>
    </>
  );
}
