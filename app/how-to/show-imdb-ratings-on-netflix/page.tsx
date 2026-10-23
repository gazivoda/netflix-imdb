import GuideLayout, { type Faq } from '../../../components/GuideLayout';
import g from '../../../components/guide.module.css';
import { ImdbChip } from '../../../components/ScoreChip';
import h from '../how-to.module.css';
import { CHROME_WEB_STORE_URL } from '../../../lib/content';
import { howTo, pageMetadata } from '../../../lib/seo';
import { STEPS } from './steps';

const PATH = '/how-to/show-imdb-ratings-on-netflix';
export const metadata = pageMetadata(PATH);

const FAQS: Faq[] = [
  {
    q: 'Does Netflix show IMDb ratings?',
    a: 'No. Netflix uses its own thumbs-based recommendations rather than IMDb scores. Its help page describes thumbs-up and double-thumbs-up ratings, which help personalize what it recommends. To see IMDb scores on Netflix title cards, you need a browser extension like Rating Watch; otherwise, look the title up on IMDb separately.',
  },
  {
    q: 'What does the IMDb number on the badge mean?',
    a: 'It is the title’s IMDb user rating, a weighted average of votes from IMDb members on a scale of 1 to 10. A higher number means IMDb users rated it better. It reflects audience opinion, not critics, which is why it can differ from the Rotten Tomatoes percentage.',
  },
  {
    q: 'Why is there no rating on some Netflix titles?',
    a: 'Rating Watch looks each title up in the OMDb database. If OMDb has no IMDb rating for it, for example a very new release or a title listed under a different name, the card shows no IMDb score. When neither score is found, no badge appears at all.',
  },
  {
    q: 'Does this work on the Netflix mobile app or a TV?',
    a: 'No. Rating Watch is a Chromium browser extension, so it works on netflix.com in desktop Chrome, Edge and Brave. It cannot add badges to the Netflix app on phones, tablets, smart TVs or streaming sticks. It has not been tested in Firefox or Safari.',
  },
  {
    q: 'Is it free, and what does it send?',
    a: 'It is free, with no account needed, and works out of the box on a shared OMDb lookup allowance that can run out on a busy day (you can add a free personal OMDb key in the extension options). To fetch a rating it sends the title name and OMDb API key to OMDb, the database that supplies the scores. It requests access to just netflix.com and omdbapi.com; the privacy policy lists the full details.',
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
            To show IMDb ratings on Netflix, install the free Rating Watch browser extension,
            open netflix.com and read the badge in the top-right corner of title cards.
          </strong>{' '}
          The number beside the star is the IMDb rating out of 10. It works in Chrome, Edge and
          Brave and needs no account.
        </>
      }
      faqs={FAQS}
      schema={[
        howTo({
          name: 'How to show IMDb ratings on Netflix',
          description:
            'Show IMDb ratings on Netflix title cards in a Chromium browser using the free Rating Watch extension.',
          totalTime: 'PT3M',
          steps: STEPS,
        }),
      ]}
    >
      <h2 className={g.h2}>How do I show IMDb ratings on Netflix?</h2>
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
        <a href={CHROME_WEB_STORE_URL} className={g.btnPrimary}>
          Add to Chrome <span aria-hidden>→</span>
        </a>
      </p>
      <p className={g.p}>
        The <a href="/install">install guide</a> covers Chrome Web Store installation,
        permissions and troubleshooting if badges do not appear.
      </p>

      <h2 className={g.h2}>What does the IMDb rating on the badge mean?</h2>
      <div className={`${h.ticket} ${h.gold}`}>
        <div className={h.stub} aria-hidden="true">
          <span className={h.stubLabel}>IMDb user rating</span>
          <span className={h.score}>
            8.1<span className={h.outOf}>/10</span>
          </span>
          <span className={h.scale}>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < 8 ? h.on : undefined} />
            ))}
          </span>
        </div>
        <p className={`${g.p} ${h.ticketBody}`}>
          The badge shows the title&rsquo;s IMDb user rating: the weighted average of votes cast by IMDb
          members, on a scale from 1 to 10. A badge reading &ldquo;<ImdbChip value="8.1" />&rdquo;
          means IMDb users rate that title 8.1 out of 10 on average. It is an audience score, so it
          says how viewers felt, not what critics concluded. The badge does not show how many
          people voted; open the title on IMDb if you want to judge how much weight a score
          carries.
        </p>
      </div>
      <p className={g.p}>
        Where available, the badge also shows a Rotten Tomatoes percentage, the share of critics
        who gave the title a positive review. The two often disagree, and the{' '}
        <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes comparison</a> explains
        why and when to trust each. If you mainly want the critics&rsquo; number, see{' '}
        <a href="/how-to/show-rotten-tomatoes-on-netflix">how to show Rotten Tomatoes scores on Netflix</a>.
      </p>

      <h2 className={g.h2}>Where do the ratings come from?</h2>
      <p className={g.p}>
        Rating Watch reads the title from each card, then a background worker looks it up in{' '}
        <a href="https://www.omdbapi.com/" target="_blank" rel="noopener noreferrer">OMDb</a>, an
        open movie database that carries IMDb ratings and Rotten Tomatoes scores. Lookups run in
        parallel and repeat titles are served from a local cache, so scrolling stays fast. The
        lookup sends the title text and OMDb API key to OMDb, which also sees your IP address.
        See the <a href="/privacy">privacy policy</a> for the full detail.
      </p>

      <h2 className={g.h2}>Can you see IMDb ratings on Netflix without an extension?</h2>
      <p className={g.p}>
        Netflix uses its own recommendation signals. Its{' '}
        <a href="https://help.netflix.com/en/node/9898" target="_blank" rel="noopener noreferrer">
          guide to rating TV shows and movies
        </a>{' '}
        describes thumbs-up and double-thumbs-up ratings, which help personalize recommendations.
        These are separate from IMDb user ratings, so they can point in different directions.
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
          <strong>Independent project.</strong> Rating Watch is not affiliated with, endorsed
          by or sponsored by Netflix, IMDb or Rotten Tomatoes. Those names belong to their owners.
        </li>
      </ul>
    </GuideLayout>
  );
}
