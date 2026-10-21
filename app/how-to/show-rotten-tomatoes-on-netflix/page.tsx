import GuideLayout, { type Faq } from '../../../components/GuideLayout';
import g from '../../../components/guide.module.css';
import h from '../how-to.module.css';
import { EXTENSION_ZIP_PATH } from '../../../lib/content';
import { howTo, pageMetadata } from '../../../lib/seo';

const PATH = '/how-to/show-rotten-tomatoes-on-netflix';
export const metadata = pageMetadata(PATH);

const RT_ABOUT_URL = 'https://www.rottentomatoes.com/about';

const STEPS = [
  {
    name: 'Install the Rating Watch extension',
    text: 'Rating Watch is not on the Chrome Web Store yet, so download the Rating Watch zip from this site, unzip it, open chrome://extensions, turn on Developer mode, click Load unpacked and select the unzipped folder. It works in Chrome, Edge or Brave and needs no account.',
  },
  {
    name: 'Open Netflix in the same browser',
    text: 'Go to www.netflix.com and sign in as usual. If Netflix was already open, reload the tab so the extension can attach to the page.',
  },
  {
    name: 'Look for the badge in the top-right corner of a title card',
    text: 'Browse any row, search results or More Like This. Cards get a small dark badge in the top-right corner. Where OMDb has a Rotten Tomatoes score, the badge shows a tomato icon and a percentage.',
  },
  {
    name: 'Read the percentage as the share of critics who liked it',
    text: 'The number is the Tomatometer: the percentage of professional critic reviews that are positive. Rotten Tomatoes treats 60% or higher as Fresh and anything below as Rotten.',
  },
  {
    name: 'Check the card again if no tomato appears',
    text: 'If a title shows only an IMDb rating, or no badge at all, the OMDb database had no Rotten Tomatoes score for it. That is a data gap, not a bug in your install.',
  },
];

const FAQS: Faq[] = [
  {
    q: 'Does Netflix show Rotten Tomatoes scores by itself?',
    a: 'No. Netflix shows its own match percentage, maturity rating and thumbs-up votes, but not Rotten Tomatoes scores. To see them on title cards while you browse, you need a browser extension such as the free Rating Watch, which adds a small badge to each card as you scroll.',
  },
  {
    q: 'Which Rotten Tomatoes score does the extension show?',
    a: 'It shows the critic percentage, the Tomatometer, as a tomato icon and a number such as 87%. It does not show the separate audience score. The figure comes from OMDb, so it reflects whatever Rotten Tomatoes value OMDb holds for that title at the moment the extension looks it up.',
  },
  {
    q: 'Why does a Netflix title have no Rotten Tomatoes score?',
    a: 'Ratings are fetched from OMDb, and OMDb does not return a Rotten Tomatoes value for every title. OMDb has Rotten Tomatoes scores mostly for films and usually none for TV series, and it can also lack them for brand-new releases and small titles. When that happens the card shows only the IMDb rating, or no badge at all if neither score exists.',
  },
  {
    q: 'Can I show Rotten Tomatoes scores on Netflix on my phone or TV?',
    a: 'Not with this extension. Rating Watch is a Chromium desktop browser extension, so it works on www.netflix.com in Chrome, Edge and Brave. It has not been tested in Firefox or Safari, and it cannot add badges to the Netflix app on phones, tablets or smart TVs.',
  },
  {
    q: 'Does it cost anything or need a Rotten Tomatoes account?',
    a: 'No. The Rating Watch extension is free and needs no sign-up or Rotten Tomatoes login. It works out of the box on a shared OMDb lookup allowance that is limited per day, so on a busy day ratings can pause and the toolbar icon shows a red exclamation mark. You can add a free personal OMDb key in the extension options to use your own allowance. It requests access only to netflix.com and omdbapi.com.',
  },
];

export default function ShowRottenTomatoesOnNetflixPage() {
  return (
    <GuideLayout
      path={PATH}
      h1="How to show Rotten Tomatoes scores on Netflix"
      lede={
        <>
          <strong>
            Netflix does not show Rotten Tomatoes scores, but the free Rating Watch browser
            extension adds them: install it, open netflix.com, and a tomato percentage appears in
            the top-right corner of title cards where OMDb has a score.
          </strong>{' '}
          It works in Chrome, Edge and Brave, and needs no account. Scores
          are mostly available for films, not TV series. Not
          affiliated with Netflix or Rotten Tomatoes.
        </>
      }
      faqs={FAQS}
      schema={[
        howTo({
          name: 'How to show Rotten Tomatoes scores on Netflix',
          description:
            'Use the free Rating Watch Chrome extension to display the Rotten Tomatoes Tomatometer on Netflix title cards.',
          totalTime: 'PT3M',
          steps: STEPS,
        }),
      ]}
    >
      <h2 className={g.h2}>How do I see Rotten Tomatoes scores on Netflix?</h2>
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
      <p className={g.p}>
        <a href={EXTENSION_ZIP_PATH} download className={g.btnPrimary}>
          Download Rating Watch (zip) <span aria-hidden>→</span>
        </a>
      </p>
      <p className={g.p}>
        The full walkthrough, including the Developer mode toggle and what to do if nothing
        appears, is on the <a href="/install">install page</a>.
      </p>

      <h2 className={g.h2}>What does the Rotten Tomatoes percentage on Netflix mean?</h2>
      <div className={`${h.ticket} ${h.signal}`}>
        <div className={h.stub} aria-hidden="true">
          <span className={h.stubLabel}>Tomatometer</span>
          <span className={h.score}>60%</span>
          <span className={h.split}>
            <span className={h.rotten}>Rotten</span>
            <span className={h.fresh}>Fresh</span>
          </span>
        </div>
        <p className={`${g.p} ${h.ticketBody}`}>
          The number is the Tomatometer. Rotten Tomatoes defines it on its{' '}
          <a href={RT_ABOUT_URL} target="_blank" rel="noopener noreferrer">
            About page
          </a>{' '}
          as &ldquo;the percentage of professional critic reviews that are positive,&rdquo; and
          says it is built from reviews by Tomatometer-approved critics and publications. A title
          with at least 60% positive reviews is labelled Fresh; below that it is Rotten.
        </p>
      </div>
      <p className={g.p}>
        The key point is that it is a share, not an average. Imagine ten critics who each call a
        film &ldquo;decent&rdquo; and give it a lukewarm 6 out of 10. All ten reviews are
        positive, so the Tomatometer reads 100%, even though nobody loved it. A film that eight
        critics rate 10 out of 10 and two pan scores 80%. So a high percentage tells you critics
        broadly approved, not that the film is a masterpiece.
      </p>
      <aside className={g.note}>
        <strong>One detail of the badge:</strong> the extension always draws the same tomato icon,
        whether the score is Fresh or Rotten. Use the 60% line to tell them apart. The IMDb rating
        (out of 10) sits beside it when OMDb has one.
      </aside>

      <h2 className={g.h2}>Where do the scores come from, and why are some missing?</h2>
      <p className={g.p}>
        Rating Watch does not scrape Rotten Tomatoes. Its background worker looks each title up
        on OMDb, a movie-data API, and reads the Rotten Tomatoes value OMDb returns. That keeps the
        extension light and limits its permissions to netflix.com and omdbapi.com, but it also
        means the extension can only show what OMDb holds.
      </p>
      <ul className={g.list}>
        <li>
          <strong>No Rotten Tomatoes score:</strong> OMDb does not return one for every title.
          OMDb has them mostly for films and usually not for TV series, and also lacks them for very new releases and small titles.
          The card then shows just the IMDb rating, or nothing. TV series usually show IMDb only.
        </li>
        <li>
          <strong>Matching is by title name:</strong> if two titles share a name, the extension may
          pick the wrong one. If a score looks off, check the title and year on Rotten Tomatoes.
        </li>
        <li>
          <strong>Possible lag:</strong> scores are whatever OMDb has at lookup time, so a recently
          released title may not yet reflect its final critic tally.
        </li>
      </ul>

      <h2 className={g.h2}>Should I trust Rotten Tomatoes or IMDb on Netflix?</h2>
      <p className={g.p}>
        Use both. Rotten Tomatoes tells you whether critics approved; IMDb is an audience rating
        out of 10 and tells you whether viewers enjoyed it. They often disagree, and the
        disagreement is informative.{' '}
        <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes: which rating to trust</a>{' '}
        explains how the two are built and when each one misleads. If you only want the audience
        score, see{' '}
        <a href="/how-to/show-imdb-ratings-on-netflix">how to show IMDb ratings on Netflix</a>.
      </p>
    </GuideLayout>
  );
}
