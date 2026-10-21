import GuideLayout, { type Faq } from '../../components/GuideLayout';
import g from '../../components/guide.module.css';
import s from './install.module.css';
import { EXTENSION_ZIP_PATH, SUPPORT_EMAIL } from '../../lib/content';
import { howTo, pageMetadata } from '../../lib/seo';

const PATH = '/install';
export const metadata = pageMetadata(PATH);

const STEPS = [
  {
    name: 'Download the extension',
    text: 'Download the Rating Watch zip from this site with the Download Rating Watch (zip) button on this page.',
  },
  {
    name: 'Unzip it to a folder you will keep',
    text: 'Extract the zip somewhere permanent. Chrome loads the extension from that folder, so moving or deleting it later disables the extension.',
  },
  {
    name: 'Open the extensions page and turn on Developer mode',
    text: 'Go to chrome://extensions (edge://extensions in Edge, brave://extensions in Brave) and switch on Developer mode in the top-right corner.',
  },
  {
    name: 'Click Load unpacked and choose the folder',
    text: 'Click Load unpacked and select the unzipped folder, the one that contains manifest.json. Rating Watch now appears in your extensions list.',
  },
  {
    name: 'Open Netflix',
    text: 'Visit netflix.com and browse. IMDb badges, with Rotten Tomatoes beside them where available, appear in the top-right corner of each title card; reload the Netflix tab if you already had it open.',
  },
];

const FAQS: Faq[] = [
  {
    q: 'Is Rating Watch on the Chrome Web Store?',
    a: 'Not yet. For now it installs as an unpacked extension from a zip you download from this site, which takes about a minute and works in Chrome, Edge, Brave and other Chromium browsers. Chrome may show a reminder about developer-mode extensions when it starts; that is normal for unpacked extensions.',
  },
  {
    q: 'Is it safe to load an unpacked extension?',
    a: 'It asks for access to only two sites: netflix.com (to read title cards and show badges) and omdbapi.com (to look up ratings). It requests no tabs, history or storage permissions, needs no account, and sends only title text (and an OMDb API key) to OMDb. After loading it, chrome://extensions shows exactly which sites it can access.',
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
    a: 'To update, replace the folder contents with the latest download and click the reload icon on the extension card at chrome://extensions. To uninstall, click Remove on the same card.',
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
            Rating Watch installs in about a minute: download the zip from this site, unzip it, turn on
            Developer mode at chrome://extensions, click Load unpacked and pick the folder.
          </strong>{' '}
          It is a free download that you add to Chrome yourself, because it is not on the Chrome Web
          Store yet; this is the install method for Chrome, Edge and Brave. The extension needs no
          account.
        </>
      }
      faqs={FAQS}
      schema={[
        howTo({
          name: 'How to install the Rating Watch Chrome extension',
          description:
            'Install the free Rating Watch extension as an unpacked extension in Chrome, Edge or Brave.',
          totalTime: 'PT2M',
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
        <a href={EXTENSION_ZIP_PATH} download className={`ds-btn ds-btn-signal ${s.download}`}>
          Download Rating Watch (zip) <span aria-hidden>→</span>
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
          Confirm the extension is switched on at <code>chrome://extensions</code> and that you
          selected the folder containing <code>manifest.json</code>, not its parent.
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
