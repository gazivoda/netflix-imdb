import styles from './ScoreChip.module.css';

type ChipProps = {
  /** Score as displayed and announced, e.g. "8.7" or "86%". */
  value: string;
  /** Optional visible text when it should differ from the score (the aria-label still announces the score). */
  text?: string;
  className?: string;
};

function Chip({ value, text, className, label, variant, hook }: ChipProps & { label: string; variant: string; hook: string }) {
  const cls = [styles.chip, variant, hook, className].filter(Boolean).join(' ');
  return (
    <span className={cls} role="img" aria-label={`${label} ${value}`}>
      {text ?? value}
    </span>
  );
}

export function ImdbChip(props: ChipProps) {
  return <Chip {...props} label="IMDb" variant={styles.imdb} hook="ds-chip-imdb" />;
}

export function RtChip(props: ChipProps) {
  return <Chip {...props} label="Rotten Tomatoes" variant={styles.rt} hook="ds-chip-rt" />;
}
