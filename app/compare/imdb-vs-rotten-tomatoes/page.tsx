import styles from './compare.module.css';
import g from '../../../components/guide.module.css';
import GuideLayout from '../../../components/GuideLayout';
import { ImdbChip, RtChip } from '../../../components/ScoreChip';
import { pageMetadata } from '../../../lib/seo';
import { isBlogHubReady } from '../../../lib/blog/inbound';

const PATH = '/compare/imdb-vs-rotten-tomatoes';

export const metadata = pageMetadata(PATH);

const ROWS = [
  {
    aspect: 'What it measures',
    imdb: 'The average rating from registered users, on a 1–10 scale.',
    rt: 'The percentage of approved critics whose review was positive (the Tomatometer).',
  },
  {
    aspect: 'Who votes',
    imdb: 'The general public, meaning anyone with an IMDb account.',
    rt: 'Professional film and TV critics (audiences get a separate score, the Popcornmeter).',
  },
  {
    aspect: 'Scale',
    imdb: '1 to 10, shown as a weighted average. IMDb does not disclose the exact weighting.',
    rt: '0% to 100%, a positive-or-not tally, not an average of how good reviews were. 60% or more is Fresh.',
  },
  {
    aspect: 'What a high score means',
    imdb: 'Lots of people enjoyed it.',
    rt: 'Most critics thought it was at least good, not necessarily great.',
  },
  {
    aspect: 'Best at spotting',
    imdb: 'Crowd-pleasers, cult favorites, and long-tail fan loyalty.',
    rt: 'Critical consensus and craft, especially for new releases.',
  },
  {
    aspect: 'Blind spot',
    imdb: 'Fan brigading and nostalgia can inflate scores.',
    rt: 'A 90% can hide films critics found merely "fine," not excellent.',
  },
];

const FAQS = [
  {
    q: 'What is the difference between IMDb and Rotten Tomatoes?',
    a: 'IMDb shows a weighted average of user ratings on a 1–10 scale, reflecting what registered members think. Rotten Tomatoes shows the Tomatometer, the percentage of professional critic reviews that are positive. IMDb measures how much people liked something; Rotten Tomatoes measures how many critics approved of it.',
  },
  {
    q: 'Is a high Rotten Tomatoes score the same as a high IMDb score?',
    a: 'No. A 90% Tomatometer means 90% of counted critic reviews were positive, but it does not say how positive. A film can score 95% on Rotten Tomatoes yet only 7.0 on IMDb if critics liked it but audiences found it forgettable. The two numbers answer different questions, which is why seeing both is more useful than either alone.',
  },
  {
    q: 'How does IMDb calculate its rating?',
    a: 'IMDb takes the ratings submitted by registered users and shows a weighted average rather than a plain mean. According to IMDb, not all ratings have the same impact, and the weighting can change if unusual voting activity is detected. IMDb does not disclose the exact method, and a TV series rating is not built from its episode ratings.',
  },
  {
    q: 'How does Rotten Tomatoes calculate the Tomatometer?',
    a: 'Rotten Tomatoes defines the Tomatometer as the percentage of professional critic reviews that are positive. A title with at least 60% positive reviews is Fresh, and one below 60% is Rotten. Certified Fresh needs 75% or higher with at least five Top Critics reviews. The separate audience score, the Popcornmeter, counts star ratings of 3.5 or higher as positive.',
  },
  {
    q: 'Which rating is more reliable, IMDb or Rotten Tomatoes?',
    a: 'Neither is universally better. Rotten Tomatoes is a good guide to critical opinion, especially for new releases. IMDb is a better signal of broad audience enjoyment once ratings have settled. For the most reliable read, compare both: agreement is a strong signal, and disagreement shows whether a title leans crowd-pleaser or critics’ darling.',
  },
  {
    q: 'Why do IMDb and Rotten Tomatoes scores disagree?',
    a: 'They disagree because they measure different things and poll different people. One is an average of audience ratings out of 10, the other is the share of critics who gave a positive review. Critics tend to reward originality, direction and writing; general audiences often reward entertainment and emotional payoff, so big gaps are common.',
  },
  {
    q: 'Can I see both scores while browsing Netflix?',
    a: 'Yes, on a computer. The free Rating Watch extension for Chrome, Edge, Brave and other Chromium browsers shows the IMDb rating and the Rotten Tomatoes score in a badge on Netflix title cards. A badge shows only the scores that the OMDb database has for that title. Rotten Tomatoes scores are mostly available for films, so TV series usually show IMDb only.',
  },
];

export default function ComparePage() {
  return (
    <GuideLayout
      path={PATH}
      h1="IMDb vs Rotten Tomatoes"
      lede={
        <>
          Two of the most-quoted ratings in film disagree all the time, because they measure
          different things.{' '}
          <strong>
            IMDb is an average audience score out of 10. Rotten Tomatoes is the percentage of
            critics who liked a film.
          </strong>{' '}
          Here&apos;s how to read each one, and why seeing both on the same Netflix card beats
          trusting either alone.
        </>
      }
      faqs={FAQS}
    >
        {/* score visual */}
      <div className={styles.versus}>
        <div className={`${styles.vsCard} ${styles.vsImdb}`}>
          <span className={styles.vsTag}><ImdbChip value="8.7" text="★ IMDb" /></span>
          <span className={styles.vsScore}>8.7<span className={styles.vsUnit}>/10</span></span>
          <span className={styles.vsWho}>What audiences rated it</span>
        </div>
        <span className={styles.vsDivider} aria-hidden>vs</span>
        <div className={`${styles.vsCard} ${styles.vsRt}`}>
          <span className={styles.vsTag}><RtChip value="86%" text="Rotten Tomatoes" /></span>
          <span className={styles.vsScore}>86<span className={styles.vsUnit}>%</span></span>
          <span className={styles.vsWho}>Share of critics who approved</span>
        </div>
      </div>

      <p className={g.note}>Example numbers for illustration, not live scores.</p>

      <h2 className={g.h2}>How do IMDb and Rotten Tomatoes differ?</h2>
      <p className={g.p}>
        A Rotten Tomatoes percentage is a head-count, not a quality average: 100% means every
        counted critic review was positive, not that the film is a masterpiece. IMDb instead
        averages how highly members rated a title out of 10. That difference explains nearly every
        disagreement between the two.
      </p>

      <div className={g.tableWrap} role="region" aria-label="IMDb and Rotten Tomatoes compared, scrolls sideways on small screens" tabIndex={0}>
        <table className={g.table}>
          <caption className="sr-only">How IMDb and Rotten Tomatoes scores differ, aspect by aspect</caption>
          <thead>
            <tr>
              <th scope="col">&nbsp;</th>
              <th scope="col"><span className={`ds-chip-imdb ${styles.thChip}`}>★ IMDb</span></th>
              <th scope="col"><span className={`ds-chip-rt ${styles.thChip}`}>Rotten Tomatoes</span></th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.aspect}>
                <th scope="row">{r.aspect}</th>
                <td>{r.imdb}</td>
                <td>{r.rt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={g.h2}>When should you trust each one?</h2>
      <p className={g.p}>
        Trust IMDb when you want to know whether regular viewers enjoyed a title, especially an
        older one whose ratings have settled. Trust Rotten Tomatoes when you want the critical
        read on a new release, or want to avoid something critics broadly panned.
      </p>
      <div className={styles.whenGrid}>
        <div className={`${styles.whenCard} ds-card`}>
          <h3 className={styles.whenTitle}><span className={`${styles.whenMark} ${styles.whenMarkImdb}`} aria-hidden>★</span> Lean on IMDb when…</h3>
          <ul className={g.list}>
            <li>You want to know if regular viewers actually enjoyed it.</li>
            <li>The title is older: fan ratings have settled over years.</li>
            <li>You&apos;re choosing a comfort rewatch or a crowd-pleaser.</li>
          </ul>
        </div>
        <div className={`${styles.whenCard} ds-card`}>
          <h3 className={styles.whenTitle}><span className={`${styles.whenMark} ${styles.whenMarkRt}`} aria-hidden /> Lean on Rotten Tomatoes when…</h3>
          <ul className={g.list}>
            <li>It&apos;s a new release and you want the critical read.</li>
            <li>You care about craft: direction, writing, performances.</li>
            <li>You want to avoid a film critics broadly panned.</li>
          </ul>
        </div>
      </div>

      <h2 className={g.h2}>Why read both scores together?</h2>
      <p className={g.p}>
        Each score alone is a partial picture. When IMDb and Rotten Tomatoes{' '}
        <strong>agree and both are high</strong>, that&apos;s a safe bet. When they{' '}
        <strong>split</strong>, the direction tells you what kind of film it is:
      </p>
      <ul className={g.list}>
        <li><strong>High IMDb, lower RT</strong>: a crowd-pleaser critics were cool on. Great for a fun night in.</li>
        <li><strong>High RT, lower IMDb</strong>: a critics&apos; darling that didn&apos;t land with everyone. Worth it if you&apos;re in the mood for something ambitious.</li>
        <li><strong>Both low</strong>: usually safe to skip.</li>
      </ul>
      {isBlogHubReady() && (
        <p className={g.p}>
          For both scores side by side on the films people actually watch, see{' '}
          <a href="/blog">the 100 most-watched Netflix films rated by critics and audiences</a>.
        </p>
      )}

      <h2 className={g.h2}>How are the scores calculated?</h2>
      <p className={g.p}>
        IMDb publishes a weighted average of ratings from registered users and keeps the exact
        weighting private. Rotten Tomatoes publishes the Tomatometer as the percentage of
        professional critic reviews that are positive. Both companies describe their methods on
        their own help pages, summarized and linked below.
      </p>
      <ul className={g.list}>
        <li>
          <strong>IMDb:</strong> uses all ratings from registered users to produce one weighted
          average. Ratings do not all count equally, and the weighting can change if unusual
          activity is detected. IMDb says it does not disclose the exact method. Source:{' '}
          <a href="https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV" target="_blank" rel="noopener noreferrer">IMDb Help, Ratings FAQ</a>.
        </li>
        <li>
          <strong>Rotten Tomatoes:</strong> the Tomatometer is the percentage of professional
          critic reviews that are positive. Titles at 60% or above are Fresh, below 60% are Rotten,
          and Certified Fresh needs 75% or higher with at least five Top Critics reviews. Source:{' '}
          <a href="https://www.rottentomatoes.com/about" target="_blank" rel="noopener noreferrer">Rotten Tomatoes, About</a>.
        </li>
      </ul>
      <p className={g.note}>
        Both pages were last checked on October 15, 2026. Either company can change its method or
        thresholds, so check the linked pages for the current rules. Rating Watch is not
        affiliated with IMDb or Rotten Tomatoes.
      </p>

      <aside className={g.callout}>
        <h2 className={g.calloutTitle}>How can you see both scores on Netflix?</h2>
        <p>
          The free <strong>Rating Watch</strong> extension puts the IMDb rating and the Rotten
          Tomatoes score on Netflix title cards as you browse in Chrome, Edge or Brave, so you can
          compare audience and critics at a glance. It is not on the Chrome Web Store yet; installing
          from a zip on this site takes about a minute.
        </p>
        <a href="/install" className={g.btnPrimary}>
          Install free <span aria-hidden>→</span>
        </a>
      </aside>
    </GuideLayout>
  );
}
