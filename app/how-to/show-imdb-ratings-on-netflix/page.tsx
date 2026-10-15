import GuideLayout, { type Faq } from '../../../components/GuideLayout';
import g from '../../../components/guide.module.css';
import { howTo, pageMetadata } from '../../../lib/seo';
import { STEPS } from './steps';

const PATH = '/how-to/show-imdb-ratings-on-netflix';
export const metadata = pageMetadata(PATH);

const FAQS: Faq[] = [
  {
    q: 'Does Netflix show IMDb ratings?',
    a: 'No. Netflix does not display IMDb ratings anywhere in its app or website. It shows its own signals instead, such as a percentage match score and its thumbs-up ratings. To see IMDb scores on Netflix, you need a browser extension like Netflix Ratings or a lookup on the IMDb site.',
  },
  {
    q: 'What does the IMDb number on the badge mean?',
    a: 'It is the title’s IMDb user rating, an average of votes from IMDb members on a scale of 1 to 10. A higher number means IMDb users rated it better. It reflects audience opinion, not critics, which is why it can differ from the Rotten Tomatoes percentage.',
  },
  {
    q: 'Why is there no rating on some Netflix titles?',
    a: 'Netflix Ratings looks each title up in the OMDb database. If OMDb has no IMDb rating for it, for example a very new release or a title listed under a different name, the card shows no IMDb score. When neither score is found, no badge appears at all.',
  },
  {
    q: 'Does this work on the Netflix mobile app or a TV?',
    a: 'No. Netflix Ratings is a Chromium browser extension, so it works on netflix.com in desktop Chrome, Edge and Brave. It cannot add badges to the Netflix app on phones, tablets, smart TVs or streaming sticks. It has not been tested in Firefox or Safari.',
  },
  {
    q: 'Is it free, and what does it send?',
    a: 'It is free and open source, with no account needed. To fetch a rating it sends only the title name to OMDb, the database that supplies the scores. It requests access to just netflix.com and omdbapi.com, and the privacy policy lists exactly what it does.',
  },
];

export default function ShowImdbRatingsOnNetflixPage() {
  return (
    <GuideLayout
      path={PATH}
      h1="How to show IMDb ratings on Netflix"
      lede={
        <>
          <strong>
            To show IMDb ratings on Netflix, install the free Netflix Ratings browser extension,
            open netflix.com and read the badge in the top-right corner of each title card.
          </strong>{' '}
          The number beside the star is the IMDb rating out of 10. It works in Chrome, Edge and
          Brave, needs no account, and the code is open source.
        </>
      }
      faqs={FAQS}
      schema={[
        howTo({
          name: 'How to show IMDb ratings on Netflix',
          description:
            'Show IMDb ratings on Netflix title cards in a Chromium browser using the free, open-source Netflix Ratings extension.',
          totalTime: 'PT3M',
          steps: STEPS,
        }),
      ]}
    >
      <h2 className={g.h2}>How do I show IMDb ratings on Netflix?</h2>
      <ol className={g.steps}>
        {STEPS.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong>
            {s.text}
          </li>
        ))}
      </ol>
      <p className={g.p}>
        <a href="/install" className={g.btnPrimary}>
          Install Netflix Ratings <span aria-hidden>→</span>
        </a>
      </p>
      <p className={g.p}>
        Step-by-step install instructions, including how to turn on Developer mode, are on the{' '}
        <a href="/install">install page</a>.
      </p>

      <h2 className={g.h2}>What does the IMDb rating on the badge mean?</h2>
      <p className={g.p}>
        The badge shows the title&rsquo;s IMDb user rating: the average of votes cast by IMDb
        members, on a scale from 1 to 10. A badge reading &ldquo;⭐ 8.1&rdquo; means IMDb users
        rate that title 8.1 out of 10 on average. It is an audience score, so it says how viewers
        felt, not what critics concluded. The badge does not show how many people voted; open the
        title on IMDb if you want to judge how much weight a score carries.
      </p>
      <p className={g.p}>
        Where available, the badge also shows a Rotten Tomatoes percentage, the share of critics
        who gave the title a positive review. The two often disagree, and the{' '}
        <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes comparison</a> explains
        why and when to trust each. If you mainly want the critics&rsquo; number, see{' '}
        <a href="/how-to/show-rotten-tomatoes-on-netflix">how to show Rotten Tomatoes scores on Netflix</a>.
      </p>

      <h2 className={g.h2}>Where do the ratings come from?</h2>
      <p className={g.p}>
        Netflix Ratings reads the title from each card, then a background worker looks it up in{' '}
        <a href="https://www.omdbapi.com/" target="_blank" rel="noopener noreferrer">OMDb</a>, an
        open movie database that carries IMDb ratings and Rotten Tomatoes scores. Lookups run in
        parallel and repeat titles are served from an in-memory cache, so scrolling stays fast. The
        only thing sent is the title text. See the <a href="/privacy">privacy policy</a> for the
        full detail.
      </p>

      <h2 className={g.h2}>Can you see IMDb ratings on Netflix without an extension?</h2>
      <p className={g.p}>
        Not on Netflix itself. Netflix does not show IMDb ratings. What it shows instead are its
        own signals, such as a percentage &ldquo;match&rdquo; score tailored to your viewing
        history and its thumbs-up ratings. Those are Netflix&rsquo;s measures, not IMDb&rsquo;s,
        and the two can point in different directions.
      </p>
      <p className={g.p}>
        Without an extension the workaround is manual: open a second tab, search for the title on
        IMDb and read the rating there. It works for a single title, but it gets tedious when you
        are scanning a whole row of options, which is the gap the extension fills.
      </p>

      <h2 className={g.h2}>What are the limits?</h2>
      <ul className={g.list}>
        <li>
          <strong>Some titles get no badge.</strong> If OMDb has no rating for a title, such as a
          brand-new release, nothing is shown for it.
        </li>
        <li>
          <strong>Lookups are by title name.</strong> When several productions share a name, the
          extension can occasionally show the score for a different one. It tries to prefer the
          newest exact-name match, but it is not perfect.
        </li>
        <li>
          <strong>Desktop browsers only.</strong> It runs on netflix.com in Chromium browsers, not
          in the Netflix mobile or TV apps, and it has not been tested in Firefox or Safari.
        </li>
        <li>
          <strong>Independent project.</strong> Netflix Ratings is not affiliated with, endorsed
          by or sponsored by Netflix, IMDb or Rotten Tomatoes. Those names belong to their owners.
        </li>
      </ul>
    </GuideLayout>
  );
}
