import GuideLayout, { type Faq } from '../../components/GuideLayout';
import g from '../../components/guide.module.css';
import s from './install.module.css';
import { CHROME_WEB_STORE_URL, SUPPORT_EMAIL } from '../../lib/content';
import { howTo, pageMetadata } from '../../lib/seo';

const PATH = '/install';
export const metadata = pageMetadata(PATH);

const STEPS = [
  {
    name: 'Open the Chrome Web Store listing',
    text: 'Use the Add to Chrome button on this page to open the official Rating Watch listing in the Chrome Web Store.',
  },
  {
    name: 'Add Rating Watch to your browser',
    text: 'Choose Add to Chrome, review the requested permissions and confirm Add extension. In Edge or Brave, the browser may first ask you to allow extensions from the Chrome Web Store; its install button wording may differ.',
  },
  {
    name: 'Open Netflix',
    text: 'Visit netflix.com and browse. IMDb badges, with Rotten Tomatoes beside them where available, appear in the top-right corner of each title card; reload the Netflix tab if you already had it open.',
  },
];

const FAQS: Faq[] = [
  {
    q: 'Is Rating Watch on the Chrome Web Store?',
    a: 'Yes. Rating Watch is available on the Chrome Web Store. Open its listing with the Add to Chrome button on this page, review the permissions and confirm the installation in your browser. Then open Netflix, or reload an existing Netflix tab, to see ratings where available. The extension is free and needs no account.',
  },
  {
    q: 'What permissions does the extension need?',
    a: 'It asks for access to only two sites: netflix.com (to read title cards and show badges) and omdbapi.com (to look up ratings). It requests no tabs, history or storage permissions and needs no account. Lookups send title text and an OMDb API key to OMDb, which also sees your IP address. Review the permissions before confirming installation.',
  },
  {
    q: 'Do I need an API key or an account?',
    a: 'You need neither to start: there is no account, and the extension works out of the box on a shared OMDb lookup allowance. That allowance is limited per day across all users, so on a busy day ratings can pause and the toolbar icon shows a red exclamation mark. Open the extension options and add a free personal OMDb key to use your own allowance.',
  },
  {
    q: 'Why is there no badge on some titles?',
    a: 'Ratings come from the OMDb database. Rotten Tomatoes scores are mostly available for films: OMDb usually has none for TV series, so series cards show IMDb only. A very new release, or a title whose Netflix name differs from the database listing, can show only one score or none.',
  },
  {
    q: 'How do I update or uninstall it?',
    a: 'The extension updates automatically through your browser by default after installation from the Chrome Web Store. To uninstall it in Chrome, open chrome://extensions, find Rating Watch and click Remove. Edge and Brave provide the same controls on their own extensions pages. Removing the extension stops the badges from appearing on Netflix.',
  },
  {
    q: 'Does it work in Firefox or Safari?',
    a: 'Rating Watch is built as a Manifest V3 Chromium extension. It has not been tested in Firefox or Safari, so Chrome, Edge and Brave are the supported browsers.',
  },
];

export default function InstallPage() {
  return (
    <GuideLayout
      path={PATH}
      h1="How to install Rating Watch"
      lede={
        <>
          <strong>
            Install Rating Watch from the Chrome Web Store: open the listing, choose Add to Chrome
            and confirm the permissions. Then open Netflix.
          </strong>{' '}
          It takes about a minute and works in desktop Chrome, Edge and Brave. The extension is
          free and needs no account.
        </>
      }
      faqs={FAQS}
      schema={[
        howTo({
          name: 'How to install the Rating Watch Chrome extension',
          description:
            'Install the free Rating Watch extension from the Chrome Web Store in desktop Chrome, Edge or Brave.',
          totalTime: 'PT1M',
          steps: STEPS,
        }),
      ]}
    >
      <h2 className={g.h2}>How do I install Rating Watch?</h2>
      <ol className={s.steps}>
        {STEPS.map((step, i) => (
          <li key={step.name} className={s.stub}>
            <span className={s.stubNum} aria-hidden>
              {i + 1}
            </span>
            <div className={s.stubBody}>
              <span className={s.tag} aria-hidden>
                Step {String(i + 1).padStart(2, '0')}
              </span>
              <strong className={s.stubName}>{step.name}</strong>
              <span className={s.stubText}>{step.text}</span>
            </div>
          </li>
        ))}
      </ol>

      <p className={s.cta}>
        <a href={CHROME_WEB_STORE_URL} className={`ds-btn ds-btn-signal ${s.download}`}>
          Add to Chrome <span aria-hidden>→</span>
        </a>
      </p>

      <h2 className={g.h2}>What you will see after installing</h2>
      <p className={g.p}>
        Each Netflix title card gets a small badge in its top-right corner showing the IMDb rating
        (out of 10) and, where OMDb has one, the Rotten Tomatoes critic score (a percentage). Films
        usually have both; TV series usually show IMDb only. New rows, search results and
        &ldquo;More Like This&rdquo; suggestions are rated automatically as they load.
      </p>

      <h2 className={g.h2}>If the badges do not appear</h2>
      <ul className={s.check}>
        <li>Reload the Netflix tab after installing, so the extension can attach to the page.</li>
        <li>
          Confirm Rating Watch is switched on at <code>chrome://extensions</code> (or your
          browser&rsquo;s extensions page) and is allowed to run on Netflix.
        </li>
        <li>Make sure you are on <code>www.netflix.com</code>; the extension only runs there.</li>
        <li>
          Seeing a red exclamation mark on the toolbar icon, or a notice that ratings are paused?
          The shared daily lookup allowance is used up. It resets daily, or open the extension
          options (click the icon) and add a free personal key from{' '}
          <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener noreferrer">
            omdbapi.com
          </a>
          .
        </li>
        <li>
          Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </li>
      </ul>

      <p className={g.p}>
        Curious how the two scores differ? Read{' '}
        <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes: which rating to trust</a>.
        Details on exactly what the extension sends are in the <a href="/privacy">privacy policy</a>.
      </p>
    </GuideLayout>
  );
}
