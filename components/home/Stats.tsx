import styles from './Stats.module.css';
import { STATS } from '../../lib/content';

export default function Stats() {
  return (
    <section className={styles.stats} aria-label="At a glance">
      {STATS.map((s) => (
        <div key={s.label} className={styles.stat}>
          <div className={styles.statValue}>{s.value}</div>
          <div className={styles.statLabel}>{s.label}</div>
          <div className={styles.statSub}>{s.sub}</div>
        </div>
      ))}
    </section>
  );
}
