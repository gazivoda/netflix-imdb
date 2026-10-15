import { pageMetadata } from '../../lib/seo';
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
          Last updated: May 4, 2025
        </p>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>What this extension does</h2>
          <p>
            Netflix Ratings is a Chrome extension that reads the title of each Netflix show or
            movie visible on your screen and fetches its IMDB rating from the OMDb public API. The
            rating is then displayed as a small badge on the title card.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Data we send to third parties</h2>
          <p>
            The only data transmitted outside your browser is the <strong>title name</strong> of each
            Netflix show or movie (e.g. &quot;Stranger Things&quot;). This is sent to the{' '}
            <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">
              OMDb API
            </a>{' '}
            solely to retrieve the IMDB rating. No other information is included in these requests.
          </p>
          <p>
            Title names are extracted from the <code>aria-label</code> attributes
            that Netflix already places on its title card links. We do not read, store, or transmit
            your Netflix watch history, account details, or any personally identifiable information.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Data we do NOT collect</h2>
          <ul>
            <li>No personally identifiable information</li>
            <li>No browsing history beyond the current Netflix page</li>
            <li>No Netflix account details, cookies, or session tokens</li>
            <li>No analytics or telemetry of any kind</li>
            <li>No data is stored on any server — there is no backend</li>
          </ul>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Local caching</h2>
          <p>
            Ratings fetched during a browser session are cached in memory (inside the extension&apos;s
            background service worker) to avoid duplicate API calls. This cache is cleared automatically
            when the service worker is terminated and is never written to disk or synced anywhere.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Third-party services</h2>
          <p>
            This extension uses the{' '}
            <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">
              OMDb API
            </a>{' '}
            to retrieve IMDB ratings. Please refer to OMDb&apos;s own privacy policy for information on
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
              <strong>https://www.omdbapi.com/*</strong> — required to fetch IMDB ratings from the
              OMDb API from the background service worker.
            </li>
          </ul>
          <p>
            No other permissions are requested. The extension does not request access to tabs,
            browsing history, storage, or any other browser APIs.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Contact</h2>
          <p>
            Questions about this privacy policy? Reach out at{' '}
            <a href="mailto:gazivodai61@gmail.com">
              gazivodai61@gmail.com
            </a>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
