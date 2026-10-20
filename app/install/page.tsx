import GuideLayout, { type Faq } from '../../components/GuideLayout';
import g from '../../components/guide.module.css';
import s from './install.module.css';
import { REPO_URL } from '../../lib/content';
import { howTo, pageMetadata } from '../../lib/seo';

const PATH = '/install';
export const metadata = pageMetadata(PATH);

const ZIP_URL = `${REPO_URL}/raw/main/extension.zip`;

const STEPS = [
  {
    name: 'Download the extension',
    text: 'Download extension.zip from the Rating Watch GitHub repository, or clone the repository and use its extension folder.',
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
    text: 'Click Load unpacked and select the folder that contains manifest.json. Rating Watch now appears in your extensions list.',
  },
  {
    name: 'Open Netflix',
    text: 'Visit netflix.com and browse. IMDb and Rotten Tomatoes badges appear in the top-right corner of each title card; reload the Netflix tab if you already had it open.',
  },
];

const FAQS: Faq[] = [
  {
    q: 'Is Rating Watch on the Chrome Web Store?',
    a: 'Not yet. For now it installs as an unpacked extension from GitHub, which takes about a minute and works in Chrome, Edge, Brave and other Chromium browsers. Chrome may show a reminder about developer-mode extensions when it starts; that is normal for unpacked extensions.',
  },
  {
    q: 'Is it safe to load an unpacked extension?',
    a: 'The source is fully open on GitHub, so you can read exactly what it does before installing. It asks for access to only two sites: netflix.com (to read title cards and show badges) and omdbapi.com (to look up ratings). It requests no tabs, history or storage permissions.',
  },
  {
    q: 'Do I need an API key or an account?',
    a: 'No. There is nothing to sign up for and no key to enter. Install it, open Netflix, and the badges appear.',
  },
  {
    q: 'Why is there no badge on some titles?',
    a: 'Ratings come from the OMDb database. If OMDb has no IMDb or Rotten Tomatoes score for a title, such as a very new release or a Netflix original with no critic reviews yet, the card shows only the score it could find, or none.',
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
            Rating Watch installs in about a minute: download it from GitHub, unzip it, turn on
            Developer mode at chrome://extensions, click Load unpacked and pick the folder.
          </strong>{' '}
          It is not on the Chrome Web Store yet, so this is the install method for Chrome, Edge and
          Brave. It is free, needs no account, and the code is open source.
        </>
      }
      faqs={FAQS}
      schema={[
        howTo({
          name: 'How to install the Rating Watch Chrome extension',
          description:
            'Install the open-source Rating Watch extension as an unpacked extension in Chrome, Edge or Brave.',
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
        <a href={ZIP_URL} className={`ds-btn ds-btn-signal ${s.download}`}>
          Download extension.zip <span aria-hidden>→</span>
        </a>
      </p>

      <aside className={s.slip}>
        <strong>Prefer git?</strong> Run <code>git clone {REPO_URL}.git</code>, then choose the{' '}
        <code>extension</code> folder in step 4. Pull and reload the extension whenever you want
        the latest version.
      </aside>

      <h2 className={g.h2}>What you will see after installing</h2>
      <p className={g.p}>
        Each Netflix title card gets a small badge in its top-right corner showing the IMDb rating
        (out of 10) and the Rotten Tomatoes critic score (a percentage). New rows, search results
        and &ldquo;More Like This&rdquo; suggestions are rated automatically as they load. If a
        title has only one of the two scores in the OMDb database, you see just that one.
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
          Still stuck? <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">Open an issue on GitHub</a>.
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
