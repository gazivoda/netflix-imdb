import GuideLayout, { type Faq } from '../../components/GuideLayout';
import s from './about.module.css';
import { AR_MODE_NAME, AUTHOR_NAME, CHROME_WEB_STORE_URL, PUBLISHED_DATE, SITE_URL, SUPPORT_EMAIL } from '../../lib/content';
import { getPage } from '../../lib/pages';
import { absoluteUrl, authorNode, isoDateTime, nodeId, pageMetadata } from '../../lib/seo';

const PATH = '/about';
export const metadata = pageMetadata(PATH);

const FAQS: Faq[] = [
  {
    q: 'Who makes Rating Watch?',
    a: `Rating Watch is made by ${AUTHOR_NAME}, an independent developer. It is not affiliated with Netflix, IMDb or Rotten Tomatoes.`,
  },
  {
    q: 'Where do the ratings come from?',
    a: 'Every score comes from the OMDb API (omdbapi.com), a third-party movie database. The extension sends only a title name, receives the IMDb rating and Rotten Tomatoes score OMDb holds for it, and shows them on the card. Rating Watch does not calculate, adjust or invent any scores.',
  },
  {
    q: 'What if a rating is wrong or missing?',
    a: `Scores are third-party data, shown exactly as OMDb returns them, so an error usually originates there or at the rating source. If you spot a wrong match or a missing badge, email ${SUPPORT_EMAIL} with the title and what you saw, and it can be investigated.`,
  },
  {
    q: 'Is Rating Watch affiliated with Netflix, IMDb or Rotten Tomatoes?',
    a: 'No. It is an independent project and is not affiliated with, endorsed by or sponsored by Netflix, IMDb or Rotten Tomatoes. Those names and logos belong to their respective owners and are used only to describe which scores the extension displays.',
  },
  {
    q: 'How can I contact the maker?',
    a: `Email ${SUPPORT_EMAIL} for bugs, wrong ratings, feature ideas or anything else. The extension has no account system, so there is nothing to manage or delete there. AR mode accounts and what happens to their data are covered by the privacy policy, and you can ask us to delete an account by email.`,
  },
];

// The ProfilePage embeds the full Person (name, url) as mainEntity rather than a bare { "@id" }: Google reads each
// JSON-LD block on its own, and the Person in the root layout's block is invisible to this one. GuideLayout already
// emits the page's WebPage node (#webpage), so this node gets its own @id and points at it.
const page = getPage(PATH);
const aboutPage = {
  '@type': ['AboutPage', 'ProfilePage'],
  '@id': nodeId(PATH, 'about'),
  url: absoluteUrl(PATH),
  name: 'About Rating Watch',
  // ProfilePage needs full date-times (Search Console: "Invalid datetime value for dateModified").
  datePublished: isoDateTime(page.published ?? PUBLISHED_DATE),
  dateModified: isoDateTime(page.updated),
  mainEntityOfPage: { '@id': nodeId(PATH, 'webpage') },
  inLanguage: 'en',
  isPartOf: { '@id': `${SITE_URL}/#website` },
  mainEntity: authorNode(),
  about: { '@id': `${SITE_URL}/#app` },
};

export default function AboutPage() {
  return (
    <GuideLayout
      path={PATH}
      h1="About Rating Watch"
      lede={
        <>
          <strong>
            Rating Watch is a free browser extension made by {AUTHOR_NAME} that
            shows IMDb and Rotten Tomatoes scores on Netflix title cards.
          </strong>{' '}
          This page explains who is behind it, why it exists, where the scores come from and how
          to report a problem.
        </>
      }
      faqs={FAQS}
      schema={[aboutPage]}
    >
      <section className={s.credits} aria-label="Maker credit">
        <div className={s.creditsMain}>
          <p className={`ds-label ${s.creditsKicker}`}>Maker credit</p>
          <p className={`ds-display ${s.creditsName}`}>{AUTHOR_NAME}</p>
        </div>
        <dl className={s.creditsStub}>
          <div className={s.stubRow}>
            <dt className="ds-label">Role</dt>
            <dd>Independent developer</dd>
          </div>
          <div className={s.stubRow}>
            <dt className="ds-label">Contact</dt>
            <dd>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </dd>
          </div>
          <div className={s.stubRow}>
            <dt className="ds-label">First release</dt>
            <dd>
              <time dateTime={PUBLISHED_DATE}>May 1, 2026</time>
            </dd>
          </div>
        </dl>
      </section>

      <h2 className={s.h2}>Who makes Rating Watch?</h2>
      <p className={s.p}>
        Rating Watch is built and maintained by {AUTHOR_NAME}, an independent developer. The
        extension is free, needs no account, and asks for access to only netflix.com and
        omdbapi.com. There is also an optional {AR_MODE_NAME}, described on the{' '}
        <a href="/pricing">pricing page</a>.
      </p>

      <h2 className={s.h2}>Why does it exist?</h2>
      <p className={s.p}>
        Choosing what to watch on Netflix usually means leaving Netflix to look the title up on
        IMDb or Rotten Tomatoes. Rating Watch removes that step by putting both scores in a
        small badge in the top-right corner of title cards, so the rating is there while you
        browse. It is deliberately small in scope: the extension does one job, needs no account, and asks for
        access to only two sites.
      </p>

      <h2 className={s.h2}>How long has it been around?</h2>
      <p className={s.p}>
        The first public release was on <time dateTime={PUBLISHED_DATE}>May 1, 2026</time>. It is
        available on the <a href={CHROME_WEB_STORE_URL}>Chrome Web Store</a>; the{' '}
        <a href="/install">install guide</a> walks through adding it in about a minute.
      </p>

      <h2 className={s.h2}>Where do the ratings come from?</h2>
      <p className={s.p}>
        All scores come from{' '}
        <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">OMDb</a>, a
        third-party movie database. The extension&apos;s background worker sends a title to OMDb,
        reads back the IMDb rating (out of 10) and the Rotten Tomatoes score (a percentage), and
        displays them. Rating Watch runs no rating system of its own. If you are unsure how the
        two numbers differ, read{' '}
        <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes: which rating to trust</a>.
      </p>

      <h2 className={s.h2}>How is accuracy handled?</h2>
      <aside className={s.note}>
        <strong>Scores are third-party data, shown as received.</strong> Rating Watch does not
        edit, round up or curate them. If a score looks wrong, it is usually wrong, outdated or
        missing at the source.
      </aside>
      <ul className={s.ledger}>
        <li>If OMDb lacks one of the two scores for a title, only the available one is shown.</li>
        <li>If OMDb has neither score, or cannot match the title, the card shows no rating.</li>
        <li>
          To report a wrong match or a bad score, email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the title and what you saw.
        </li>
      </ul>

      <h2 className={s.h2}>Is it independent of Netflix?</h2>
      <p className={s.p}>
        Yes. Rating Watch is not affiliated with, endorsed by or sponsored by Netflix, IMDb or
        Rotten Tomatoes. Those names and any related marks belong to their owners and are used only
        to describe what the extension shows. It does not collect your viewing history; the{' '}
        <a href="/privacy">privacy policy</a> lists exactly what is sent.
      </p>

      <h2 className={s.h2}>How do I get in touch?</h2>
      <p className={s.p}>
        For bugs, wrong ratings, ideas or anything else, email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </GuideLayout>
  );
}
