import { pageMetadata } from '../../lib/seo';
import { SUPPORT_EMAIL } from '../../lib/content';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import s from './privacy.module.css';

export const metadata = pageMetadata('/privacy');

export default function PrivacyPage() {
  return (
    <div className={s.page}>
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        <h1 className={`ds-display ${s.h1}`}>Privacy Policy</h1>
        <p className={`ds-label ${s.updated}`}>
          Last updated: October 20, 2026
        </p>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>What this extension does</h2>
          <p>
            Rating Watch is a Chrome extension that reads the title of each Netflix show or
            movie visible on your screen and fetches its IMDb and Rotten Tomatoes ratings from the OMDb public API. The
            ratings are then displayed as a small badge on the title card.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Data we send to third parties</h2>
          <p>
            The only data the extension transmits outside your browser is the <strong>title name</strong> of each
            Netflix show or movie (e.g. &quot;Stranger Things&quot;). This is sent to the{' '}
            <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">
              OMDb API
            </a>{' '}
            solely to retrieve its IMDb and Rotten Tomatoes ratings. No other information is included in these requests.
          </p>
          <p>
            Title names are extracted from the <code>aria-label</code> attributes
            that Netflix already places on its title card links. The extension does not read, store, or transmit
            your Netflix watch history, account details, or any personally identifiable information.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Data the extension does NOT collect</h2>
          <ul>
            <li>No personally identifiable information</li>
            <li>No browsing history beyond the current Netflix page</li>
            <li>No Netflix account details, cookies, or session tokens</li>
            <li>No analytics or telemetry of any kind</li>
            <li>No data is stored on any server, because the extension has no backend</li>
          </ul>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Local caching</h2>
          <p>
            Ratings already looked up (title name, IMDb score and Rotten Tomatoes score) are remembered
            for up to a week in the extension&apos;s own private browser database, so the same title is not
            requested from OMDb again. This data stays on your device, is never synced or sent
            anywhere, and is removed when you uninstall the extension. If you choose to add your own
            free OMDb API key on the settings page, that key is stored the same way and is sent only to
            omdbapi.com with each lookup.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Third-party services</h2>
          <p>
            This extension uses the{' '}
            <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">
              OMDb API
            </a>{' '}
            to retrieve IMDb and Rotten Tomatoes ratings. Please refer to OMDb&apos;s own privacy policy for information on
            how they handle API requests.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Permissions</h2>
          <p>
            The extension requests the following host permissions:
          </p>
          <ul>
            <li>
              <strong>https://www.netflix.com/*</strong> — required to inject the content script that
              reads title card labels and displays rating badges on the Netflix interface.
            </li>
            <li>
              <strong>https://www.omdbapi.com/*</strong> — required to fetch IMDb and Rotten Tomatoes ratings from the
              OMDb API from the background service worker.
            </li>
          </ul>
          <p>
            No other permissions are requested. The extension does not request access to tabs,
            browsing history, or cookies.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Accounts and payments (AR mode)</h2>
          <p>
            The sections above describe the Chrome extension, which needs no account. This section
            covers AR mode, which does.
          </p>
          <p>
            Signing in with Google gives us your Google account id, name, email address and profile
            picture URL. We store them together with your trial and subscription status so we can show
            your account. If you subscribe, we also store your Paddle customer and subscription ids,
            your plan (monthly or yearly) and the dates of your current billing period alongside your
            Google account data.
          </p>
          <p>
            AR mode uses three cookies, all set by rating.watch and used only for signing in:
          </p>
          <ul>
            <li>
              <code>rw_session</code> keeps you signed in for 14 days.
            </li>
            <li>
              <code>rw_oauth_state</code> protects the Google sign-in against forged requests. It
              lasts 5 minutes and exists only while you sign in.
            </li>
            <li>
              <code>rw_next</code> remembers which page to return you to after sign-in. It lasts 5
              minutes and exists only while you sign in.
            </li>
          </ul>
          <p>
            Two outside providers are involved. Google handles sign-in, and Paddle handles payments as
            our merchant of record, which means Paddle sells the subscription to you and collects your
            payment details under its own privacy policy. We never see your card number. Each acts as
            a processor or independent provider for its part, under its own terms.
          </p>
          <p>
            We keep account data until you ask us to delete your account.
          </p>
          <p>
            Camera frames used by AR mode are analysed in your browser and are never uploaded. Only
            the recognised title text is sent to look up ratings.
          </p>
          <p>
            You can ask us to delete your account by emailing{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Website analytics</h2>
          <p>
            This website, rating.watch, uses Google Analytics 4 to count visits and see which pages
            are read. The Chrome extension contains no analytics, and nothing from AR mode, including
            camera frames, is ever part of it.
          </p>
          <p>
            When you visit a page, Google Analytics receives the page address, your approximate
            location (country or city level, derived from your connection), your device and browser
            type, and the site that referred you. It sets two cookies in your browser,{' '}
            <code>_ga</code> and <code>_ga_S5744YW7M7</code>, which last up to two years and tell
            returning visitors apart. We look at the reports only in aggregate.
          </p>
          <p>
            Google processes this data under its own terms. You can stop it with your browser&apos;s
            tracking protection, a content blocker, or Google&apos;s{' '}
            <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer">
              Analytics opt-out add-on
            </a>
            . Blocking it does not change what the website or the extension can do for you.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Contact</h2>
          <p>
            Questions about this privacy policy? Reach out at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
