import styles from './Story.module.css';

export default function Story() {
  return (
    <section className={styles.story} aria-labelledby="story-title">
      <div className={styles.storyHead}>
        <p className={styles.storyLabel}>Why it matters</p>
        <h2 id="story-title" className={styles.storyTitle}>
          Why put IMDb and Rotten Tomatoes <em>scores</em> on Netflix title cards?
        </h2>
      </div>
      <div className={styles.storyBody}>
        <p>
          Choosing what to watch often turns into a long scroll that ends with giving up or
          settling for something forgettable. Netflix shows you gorgeous
          artwork and a one-line hook — but never the one number that actually predicts whether
          you&apos;ll enjoy it. So you open a second tab, search the title, skim a rating, switch
          back, and repeat. Every single time.
        </p>
        <p>
          Rating Watch removes that loop entirely. By placing the <strong>IMDb</strong> user
          score and the <strong>Rotten Tomatoes</strong> critic score directly on each title
          card, the decision happens where you already are. You glance, you compare the audience
          and the critics in the same look, and you press play with confidence — or scroll on
          without a second thought.
        </p>
        <p>
          Because both numbers load in parallel as you browse, there&apos;s no lag and no
          card-by-card waiting. New rows, search results and &ldquo;More Like This&rdquo;
          suggestions are all covered automatically. It&apos;s the context Netflix should have
          shipped years ago — quietly added back in.
        </p>
        <blockquote className={styles.pullQuote}>
          &ldquo;Two trusted scores, on every card, in the time it takes to scroll.&rdquo;
        </blockquote>
      </div>
    </section>
  );
}
