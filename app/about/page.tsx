import GuideLayout, { type Faq } from '../../components/GuideLayout';
import s from './about.module.css';
import { AUTHOR_NAME, PUBLISHED_DATE, REPO_URL, SITE_URL } from '../../lib/content';
import { absoluteUrl, authorRef, pageMetadata } from '../../lib/seo';

const PATH = '/about';
export const metadata = pageMetadata(PATH);

const AUTHOR_PROFILE_URL = 'https://github.com/gazivoda';
const CONTACT_EMAIL = 'gazivodai61@gmail.com'; // already public on /privacy

const FAQS: Faq[] = [
  {
    q: 'Who makes Rating Watch?',
    a: `Rating Watch is made by ${AUTHOR_NAME}, an independent developer who publishes the project on GitHub under the username gazivoda. It is a personal open-source project, not a company product, and it is not affiliated with Netflix, IMDb or Rotten Tomatoes.`,
  },
  {
    q: 'Where do the ratings come from?',
    a: 'Every score comes from the OMDb API (omdbapi.com), a third-party movie database. The extension sends only a title name, receives the IMDb rating and Rotten Tomatoes score OMDb holds for it, and shows them on the card. Rating Watch does not calculate, adjust or invent any scores.',
  },
  {
    q: 'What if a rating is wrong or missing?',
    a: 'Scores are third-party data, shown exactly as OMDb returns them, so an error usually originates there or at the rating source. If you spot a wrong match or a missing badge, open an issue on the GitHub repository with the title and what you saw, and it can be investigated.',
  },
  {
    q: 'Is Rating Watch affiliated with Netflix, IMDb or Rotten Tomatoes?',
    a: 'No. It is an independent project and is not affiliated with, endorsed by or sponsored by Netflix, IMDb or Rotten Tomatoes. Those names and logos belong to their respective owners and are used only to describe which scores the extension displays.',
  },
  {
    q: 'How can I contact the maker?',
    a: `The best route for bugs, wrong ratings and feature ideas is a GitHub issue, because the answer then helps everyone. For anything else, email ${CONTACT_EMAIL}. The project has no account system, so there is no user account to manage or delete.`,
  },
];

// References the layout's Person (#author) instead of redefining it.
const aboutPage = {
  '@type': ['AboutPage', 'ProfilePage'],
  '@id': `${absoluteUrl(PATH)}#webpage`,
  url: absoluteUrl(PATH),
  name: 'About Rating Watch',
  datePublished: '2026-10-15',
  dateModified: '2026-10-15',
  inLanguage: 'en',
  isPartOf: { '@id': `${SITE_URL}/#website` },
  mainEntity: authorRef,
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
            Rating Watch is a free, open-source browser extension made by {AUTHOR_NAME} that
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
            <dt className="ds-label">Source</dt>
            <dd>
              <a href={AUTHOR_PROFILE_URL} target="_blank" rel="noopener noreferrer">
                GitHub / gazivoda
              </a>
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
        code, the issue tracker and the release history all live on GitHub, so you can check the
        work directly: see the{' '}
        <a href={AUTHOR_PROFILE_URL} target="_blank" rel="noopener noreferrer">
          {AUTHOR_NAME} profile on GitHub
        </a>{' '}
        and the{' '}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          project repository
        </a>
        . It is a personal project, not a company product.
      </p>

      <h2 className={s.h2}>Why does it exist?</h2>
      <p className={s.p}>
        Choosing what to watch on Netflix usually means leaving Netflix to look the title up on
        IMDb or Rotten Tomatoes. Rating Watch removes that step by putting both scores in a
        small badge in the top-right corner of every title card, so the rating is there while you
        browse. It is deliberately small in scope: it does one job, needs no account, and asks for
        access to only two sites.
      </p>

      <h2 className={s.h2}>How long has it been around?</h2>
      <p className={s.p}>
        The first public release was on <time dateTime={PUBLISHED_DATE}>May 1, 2026</time>. It is
        currently installed as an unpacked extension from GitHub rather than from the Chrome Web
        Store; the <a href="/install">install guide</a> walks through it in about a minute.
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
          To report a wrong match or a bad score, open an issue on the{' '}
          <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">GitHub issue tracker</a>{' '}
          with the title and what you saw.
        </li>
      </ul>

      <h2 className={s.h2}>Is it independent of Netflix?</h2>
      <p className={s.p}>
        Yes. Rating Watch is not affiliated with, endorsed by or sponsored by Netflix, IMDb or
        Rotten Tomatoes. Those names and any related marks belong to their owners and are used only
        to describe what the extension shows. It does not collect your viewing history; the{' '}
        <a href="/privacy">privacy policy</a> lists exactly what is sent.
      </p>

      <h2 className={s.h2}>Is it open source, and how do I get in touch?</h2>
      <p className={s.p}>
        The full source is public in the{' '}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub repository</a>, so
        anyone can read, audit and discuss it. For bugs, wrong ratings and ideas, a GitHub issue is
        the best route. For anything else, email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </GuideLayout>
  );
}
