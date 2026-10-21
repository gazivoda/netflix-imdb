import GuideLayout, { type Faq } from '../../../components/GuideLayout';
import g from '../../../components/guide.module.css';
import { ImdbChip, RtChip } from '../../../components/ScoreChip';
import h from '../how-to.module.css';
import { howTo, pageMetadata } from '../../../lib/seo';
import { isBlogHubReady } from '../../../lib/blog/inbound';

const PATH = '/how-to/find-what-to-watch-on-netflix';
export const metadata = pageMetadata(PATH);

// The routine renders as the visible ordered list AND feeds the HowTo schema,
// so the markup and the structured data cannot drift apart.
const STEPS = [
  {
    name: 'Scan the row and read the badges',
    text: 'Browse a Netflix row and glance at the badge in the top-right corner of each card. It shows the IMDb rating out of 10 and, where OMDb has one, the Rotten Tomatoes percentage (mostly films, not TV series). A badge that still shows a loading placeholder fills in within a moment.',
  },
  {
    name: 'Drop anything where both scores are low',
    text: 'If IMDb and Rotten Tomatoes are both low, skip the title. Two different groups reaching the same verdict is the strongest signal on the page.',
  },
  {
    name: 'Shortlist titles where both scores are high',
    text: 'Titles that audiences and critics both rate highly are your safe picks. Take two or three of these as your shortlist.',
  },
  {
    name: 'Break ties with your mood',
    text: 'For a split title, choose by mood: a higher IMDb score and lower Rotten Tomatoes score suggests a crowd-pleaser for a relaxed night; a higher Rotten Tomatoes score and lower IMDb score suggests something critics admired that rewards attention.',
  },
  {
    name: 'Check the vote count on borderline or new picks',
    text: 'If a title is new or you are unsure about it, open its IMDb page to see how many people have voted. Scores from few votes can move quickly, so treat them as provisional.',
  },
  {
    name: 'Press play and give it a fair start',
    text: 'Pick one title from the shortlist and start it. If it is not working after the first episode or the first stretch of the film, move to the next shortlisted title instead of browsing from scratch.',
  },
];

// Visual-only score examples for each row (decorative; the row text carries the meaning).
const TABLE: { seen: string; tone?: 'go' | 'skip'; marks: { imdb?: string; rt?: string; tag?: string }; means: string; action: string }[] = [
  {
    seen: 'Both scores high',
    tone: 'go',
    marks: { imdb: 'High', rt: 'High' },
    means: 'Audiences and critics agree it is good.',
    action: 'Safe pick. Watch it.',
  },
  {
    seen: 'IMDb high, Rotten Tomatoes lower',
    marks: { imdb: 'High', rt: 'Lower' },
    means: 'A crowd-pleaser that critics were cooler on.',
    action: 'Good for a fun, low-effort night.',
  },
  {
    seen: 'Rotten Tomatoes high, IMDb lower',
    marks: { imdb: 'Lower', rt: 'High' },
    means: 'A critics’ favorite that did not win over everyone.',
    action: 'Choose it when you want something ambitious.',
  },
  {
    seen: 'Both scores low',
    tone: 'skip',
    marks: { imdb: 'Low', rt: 'Low' },
    means: 'Neither audiences nor critics were impressed.',
    action: 'Skip it.',
  },
  {
    seen: 'Only one score shown',
    marks: { tag: 'One score' },
    means: 'The other score is not in the OMDb database for that title.',
    action: 'Use the one you have, with less confidence.',
  },
  {
    seen: 'No badge at all',
    marks: { tag: 'No badge' },
    means: 'OMDb has no rating for that title.',
    action: 'Judge it by trailer and description instead.',
  },
  {
    seen: 'Brand-new release',
    marks: { tag: 'New' },
    means: 'Scores are still settling.',
    action: 'Treat them as a first impression and re-check later.',
  },
];

const FAQS: Faq[] = [
  {
    q: 'How do I choose what to watch on Netflix quickly?',
    a: 'Compare the IMDb rating and the Rotten Tomatoes percentage together. If both are high, it is a safe pick; if both are low, skip it; if they split, choose by mood. The Rating Watch extension adds the IMDb rating to title cards, plus the Rotten Tomatoes percentage where OMDb has one (mostly films, not TV series), so you can decide while browsing instead of opening other sites.',
  },
  {
    q: 'What IMDb and Rotten Tomatoes scores count as good?',
    a: 'There is no official cutoff, so pick a starting point and adjust it to your taste. A reasonable approach is to shortlist titles that are comfortably above the middle on both scores, for example well over 6 out of 10 on IMDb and well over 60% on Rotten Tomatoes. If your picks feel too hit-or-miss, raise the bar.',
  },
  {
    q: 'Should I trust ratings on a brand-new title?',
    a: 'Be cautious. A new release may have few votes, and early scores can shift as more people watch and more reviews arrive. A rating from a handful of voters says little, so treat it as a first impression, check the vote count on the title’s IMDb page, and consider re-checking after a few weeks.',
  },
  {
    q: 'What if IMDb and Rotten Tomatoes disagree?',
    a: 'Read the direction of the gap. A higher IMDb score with lower Rotten Tomatoes usually means a crowd-pleaser that critics found less impressive; a higher Rotten Tomatoes score with lower IMDb usually means a critics’ favorite that audiences found less satisfying. Then pick based on whether you want easy fun or something more demanding.',
  },
  {
    q: 'Does Rating Watch show how many people voted?',
    a: 'No. The badge shows only the IMDb rating out of 10 and the Rotten Tomatoes percentage. To see vote counts, open the title on IMDb. For borderline or brand-new titles, that extra step is worth taking before you commit to a long series.',
  },
];

export default function FindWhatToWatchPage() {
  return (
    <GuideLayout
      path={PATH}
      h1="How to find what to watch on Netflix"
      lede={
        <>
          <strong>
            The fastest way to choose what to watch on Netflix is to read the IMDb rating and the
            Rotten Tomatoes score together: both high is a safe pick, both low is a skip, and a
            split tells you what kind of title it is.
          </strong>{' '}
          This guide turns that into a 60-second routine, with the caveats that stop ratings from
          misleading you.
        </>
      }
      faqs={FAQS}
      schema={[
        howTo({
          name: 'How to choose what to watch on Netflix in 60 seconds',
          description:
            'A short routine for picking a Netflix title by reading IMDb and Rotten Tomatoes ratings together.',
          totalTime: 'PT1M',
          steps: STEPS,
        }),
      ]}
    >
      <h2 className={g.h2}>How do I read IMDb and Rotten Tomatoes together?</h2>
      <p className={g.p}>
        The two scores measure different things. IMDb is an average rating from the general
        public, out of 10. Rotten Tomatoes is the percentage of critics who gave a positive
        review. Because they come from different groups with different priorities, their
        agreement is informative. Our{' '}
        <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes comparison</a> explains
        the difference in detail; here is the short version for choosing.
      </p>
      <ul className={g.list}>
        <li>
          <strong>Both high:</strong> the safest pick. Audiences and critics rarely agree by
          accident.
        </li>
        <li>
          <strong>High IMDb, lower Rotten Tomatoes:</strong> a crowd-pleaser. Good when you want
          to be entertained.
        </li>
        <li>
          <strong>High Rotten Tomatoes, lower IMDb:</strong> a critics&rsquo; favorite. Good when
          you want something ambitious and have the attention for it.
        </li>
        <li>
          <strong>Both low:</strong> usually safe to skip.
        </li>
      </ul>
      {isBlogHubReady() && (
        <p className={g.p}>
          To see these patterns on real titles, our{' '}
          <a href="/blog">IMDb and Rotten Tomatoes scores for the 100 most-watched Netflix films</a>{' '}
          shows where critics and audiences agree and where they split.
        </p>
      )}

      <h2 className={g.h2}>How do I choose what to watch on Netflix in 60 seconds?</h2>
      <p className={g.p}>
        This routine assumes you have{' '}
        <a href="/install">installed the Rating Watch extension</a>, which adds a badge to the
        top-right corner of title cards showing the IMDb rating and, where OMDb has one, the
        Rotten Tomatoes percentage. Without it, you would be opening two other sites for every title.
      </p>
      <div className={h.stubs}>
        <ol className={g.steps}>
          {STEPS.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>
              {s.text}
            </li>
          ))}
        </ol>
      </div>

      <h2 className={g.h2}>What should I do for each score pattern?</h2>
      <div className={`${g.tableWrap} ${h.board}`}>
        <table className={h.boardTable} role="table">
          <caption className="sr-only">What each IMDb and Rotten Tomatoes score pattern usually means, and what to do</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">What the badge shows</th>
              <th scope="col" role="columnheader">What it usually means</th>
              <th scope="col" role="columnheader">What to do</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {TABLE.map((r) => (
              <tr key={r.seen} role="row" className={r.tone ? h[r.tone] : undefined}>
                <th scope="row" role="rowheader">
                  {r.seen}
                  <span className={h.chips} aria-hidden="true">
                    {r.marks.imdb && <ImdbChip value={r.marks.imdb} />}
                    {r.marks.rt && <RtChip value={r.marks.rt} />}
                    {r.marks.tag && <span className={h.tag}>{r.marks.tag}</span>}
                  </span>
                </th>
                <td role="cell" data-label="What it usually means">{r.means}</td>
                <td role="cell" data-label="What to do">{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={g.h2}>Why do vote counts and release dates matter?</h2>
      <p className={g.p}>
        A rating is only as stable as the number of people behind it. An average from a handful of
        voters can swing sharply with a few more, while an average from a very large crowd barely
        moves. The badge shows the rating but not the vote count, so for a borderline title open
        its IMDb page and see how many people voted before you trust a 9.0.
      </p>
      <p className={g.p}>
        Release date matters for the same reason. Brand-new titles have had little time to collect
        votes and reviews, so their scores are a first impression. Older titles have settled
        ratings, which is why a long-standing classic is often a safer bet than a title that
        appeared last week.
      </p>

      <h2 className={g.h2}>How do genre and mood change which score to trust?</h2>
      <ul className={g.list}>
        <li>
          <strong>Comedy, horror, action, reality:</strong> you are choosing for fun, so weight
          the IMDb audience score more. A lower Rotten Tomatoes percentage here often just means
          critics wanted something different.
        </li>
        <li>
          <strong>Drama, documentary, prestige series:</strong> craft is the point, so weight
          Rotten Tomatoes more. A high critic score is a useful reason to try something
          unfamiliar.
        </li>
        <li>
          <strong>Comfort rewatch:</strong> ignore the scores and watch what you love.
        </li>
        <li>
          <strong>Watching with other people:</strong> favor titles where both scores are high, so
          nobody feels dragged along.
        </li>
      </ul>
      <p className={g.p}>
        These are rules of thumb, not laws. Ratings measure what many people thought, not what you
        will think, so adjust them to your own taste after a few picks.
      </p>

      <aside className={g.note}>
        <strong>Where the numbers come from.</strong> Rating Watch looks titles up in the OMDb
        database. If OMDb has no score for a title, the card shows only the score it could find,
        or no badge. The extension is not affiliated with Netflix, IMDb or Rotten Tomatoes.
      </aside>

      <aside className={g.callout}>
        <h2 className={g.calloutTitle}>Put both scores on your Netflix cards</h2>
        <p>
          The routine above takes seconds when the ratings are already in front of you. The Rating
          Watch extension is free, needs no account, and takes about a minute to set up.
        </p>
        <a href="/install" className={g.btnPrimary}>
          How to install <span aria-hidden>→</span>
        </a>
      </aside>

      <p className={g.p}>
        Related guides:{' '}
        <a href="/how-to/show-imdb-ratings-on-netflix">how to show IMDb ratings on Netflix</a> and{' '}
        <a href="/how-to/show-rotten-tomatoes-on-netflix">how to show Rotten Tomatoes scores on Netflix</a>.
      </p>
    </GuideLayout>
  );
}
