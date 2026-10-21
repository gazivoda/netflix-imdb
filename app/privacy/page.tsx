import { pageMetadata } from '../../lib/seo';
import { SUPPORT_EMAIL, LEGAL_ENTITY, LEGAL_ADDRESS } from '../../lib/content';
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
          Last updated: October 21, 2026
        </p>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Who is responsible</h2>
          <p>
            Rating Watch (rating.watch) is the controller of the personal data described on this
            page. You can reach us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            {LEGAL_ENTITY ? ` Operated by ${LEGAL_ENTITY}.` : ''}
            {LEGAL_ADDRESS ? ` Address: ${LEGAL_ADDRESS}.` : ''}
          </p>
          <p>
            The Rating Watch Chrome extension, the website and AR mode are different parts of the
            product and handle different data. Each section below says which part it covers.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>What this extension does</h2>
          <p>
            Rating Watch is a Chrome extension that reads the title of each Netflix show or
            movie visible on your screen and fetches its IMDb and Rotten Tomatoes ratings from the OMDb public API. The
            ratings are then displayed as a small badge on the title card.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Data the extension sends to third parties</h2>
          <p>
            The extension sends the <strong>title name</strong> of each Netflix show or movie (for
            example &quot;Stranger Things&quot;) to the{' '}
            <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">
              OMDb API
            </a>{' '}
            to retrieve its IMDb and Rotten Tomatoes ratings. Every request also carries an OMDb API
            key: the shared key built into the extension, or your own if you added one in the
            extension options. Because it is an ordinary web request, OMDb also receives your IP
            address and your browser&apos;s user agent. OMDb sees the key, not any account of yours.
          </p>
          <p>
            Title names are read from the <code>aria-label</code> attributes that Netflix already
            places on its title card links and, for the larger pop-up, from the alt text of its
            poster image. The extension does not read, store, or transmit your Netflix watch
            history, account details, or any personally identifiable information. It never contacts
            rating.watch or any server of ours.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Data the extension does NOT collect</h2>
          <ul>
            <li>No personally identifiable information</li>
            <li>No browsing history beyond the current Netflix page</li>
            <li>No Netflix account details, cookies, or session tokens</li>
            <li>No analytics or telemetry of any kind</li>
            <li>No data is stored on any server run by Rating Watch, because the extension has no backend</li>
          </ul>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Local caching and your own key</h2>
          <p>
            Ratings already looked up (title name, IMDb score, Rotten Tomatoes score and the time of
            the lookup) are remembered in the extension&apos;s own private browser database, so the
            same title is not requested from OMDb again. A title with a score is remembered for up
            to 7 days, and a title OMDb had nothing for is remembered for 1 day. This data stays on
            your device, is never synced or sent anywhere, and is removed when you uninstall the
            extension.
          </p>
          <p>
            The extension works out of the box on a shared OMDb key, which has a daily lookup limit
            shared by all users. If you choose to add your own free OMDb key on the extension&apos;s
            options page, that key is stored in the same private database and is sent only to
            omdbapi.com with each lookup. You can switch back to the shared key there at any time.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Third-party services used by the extension</h2>
          <p>
            The extension uses the{' '}
            <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer">
              OMDb API
            </a>{' '}
            to retrieve IMDb and Rotten Tomatoes ratings. OMDb is an independent service that
            decides for itself what it does with the requests it receives. Please refer to
            OMDb&apos;s own terms and privacy information for how it handles them.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Permissions</h2>
          <p>
            The extension requests the following host permissions:
          </p>
          <ul>
            <li>
              <strong>https://www.netflix.com/*</strong>: required to inject the content script that
              reads title card labels and displays rating badges on the Netflix interface.
            </li>
            <li>
              <strong>https://www.omdbapi.com/*</strong>: required to fetch IMDb and Rotten Tomatoes ratings from the
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
            Two outside providers are involved, and each is an independent controller of its own
            data. Google handles your sign-in under its own privacy policy. Paddle is our
            merchant of record: it sells the subscription to you, collects your payment details,
            calculates and collects taxes and issues invoices, under its own privacy policy. We
            never see your card number. Our hosting provider processes the data on our servers on
            our instructions.
          </p>
          <p>We keep account data until you ask us to delete your account.</p>
          <p>
            Camera frames used by AR mode are analysed in your browser and are never uploaded. Only
            the recognised title text is sent to our server to look up ratings (see below). AR mode
            also keeps small fingerprints of the title cards you teach it, with their titles, in your
            browser&apos;s local storage under <code>ar-card-index-v1</code>. That stays on your
            device. A debug tool that is hidden from normal visitors can save a frame to your own
            device; it never uploads it.
          </p>
          <p>
            You can ask us to delete your account by emailing{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Payment and tax records that
            Paddle must keep by law are held by Paddle, not by us.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Title lookups from the camera pages</h2>
          <p>
            The camera demo and AR mode send the title text they recognise to our own server
            (<code>/api/ratings</code>). The server asks OMDb for the scores with its own key and
            keeps each title and its scores in a cache, so repeat lookups are not sent to OMDb again.
            That cache holds no information about you. Like any web server, ours and our hosting
            provider&apos;s see your IP address and browser details when you make a request. The IP
            address is used for abuse protection (a short-lived rate limit in server memory) and
            appears in standard server access logs.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Scripts loaded from other servers</h2>
          <ul>
            <li>
              <strong>Paddle.js</strong> (from <code>cdn.paddle.com</code>) loads on the pricing and
              account pages, and on the AR mode page when it offers checkout, so that checkout can
              open. Your browser contacts Paddle when the page loads, so Paddle receives your IP
              address and browser details at that point, before you press any button. Paddle&apos;s own
              cookies are governed by Paddle&apos;s privacy policy.
            </li>
            <li>
              <strong>OCR engine</strong> (from <code>cdn.jsdelivr.net</code>): the camera demo and
              AR mode download the Tesseract.js text-recognition worker, its WebAssembly core and the
              English language data from the jsDelivr content delivery network. jsDelivr&apos;s
              operators receive your IP address and browser details with those requests. No camera
              frame is part of them.
            </li>
          </ul>
          <p>
            Fonts are served from rating.watch itself, so no font provider is contacted.
          </p>
        </section>

        <section id="website-analytics" className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Website analytics</h2>
          <p>
            This website, rating.watch, can use Google Analytics 4 to count visits and see which pages
            are read. It is off until you accept it: analytics loads only after you press Accept in the
            cookie banner, and nothing is sent to Google before that.
            The Chrome extension contains no analytics, and nothing from AR mode, including camera
            frames, is ever part of it.
          </p>
          <p>
            If you accept, Google Analytics receives the page address, your approximate
            location (country or city level, derived from your connection), your device and browser
            type, and the site that referred you. It sets two cookies in your browser,{' '}
            <code>_ga</code> and <code>_ga_S5744YW7M7</code>, which last up to two years and tell
            returning visitors apart. We look at the reports only in aggregate.
          </p>
          <p>
            Your choice is remembered in your browser&apos;s local storage under <code>rw_consent</code>{' '}
            for 12 months, after which we ask again. You can change it at any time with
            &quot;Cookie settings&quot; in the footer. Withdrawing consent stops measurement and deletes
            the Google cookies from your browser.
          </p>
          <p>
            Google is an independent controller for the data it collects this way and processes it
            under its own terms. You can also stop it with your browser&apos;s
            tracking protection, a content blocker, or Google&apos;s{' '}
            <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer">
              Analytics opt-out add-on
            </a>
            . Declining or blocking it does not change what the website or the extension can do for you.
            Separately, Paddle&apos;s checkout may set its own cookies when you open it.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Why we may process your data (legal bases)</h2>
          <ul>
            <li>
              <strong>Consent</strong>: Google Analytics on this website. You can withdraw it at any
              time with &quot;Cookie settings&quot; in the footer.
            </li>
            <li>
              <strong>Contract</strong>: your account, trial and subscription for AR mode, including
              sign-in and the data needed to give you access.
            </li>
            <li>
              <strong>Legitimate interests</strong>: keeping the website and the lookup server secure
              and working (rate limiting, server logs, abuse prevention), and answering your emails.
              We use them only where your interests and rights do not outweigh ours.
            </li>
          </ul>
          <p>
            Browsing the website and using the extension do not require you to give us personal
            data. Creating an account for AR mode does, because we cannot give you access without
            it. We make no decisions about you by purely automated means.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>How long we keep data</h2>
          <ul>
            <li>
              <strong>Extension cache and personal key</strong>: on your device only. Scores are
              kept 7 days (1 day when OMDb had none) and everything is removed when you uninstall.
            </li>
            <li>
              <strong>Account data</strong> (Google id, name, email, picture URL, trial and
              subscription status, Paddle ids, plan, billing period): until you ask us to delete
              your account.
            </li>
            <li>
              <strong>Sign-in cookies</strong>: <code>rw_session</code> 14 days;{' '}
              <code>rw_oauth_state</code> and <code>rw_next</code> 5 minutes.
            </li>
            <li>
              <strong>Cookie choice</strong> (<code>rw_consent</code>): 12 months, in your browser.
            </li>
            <li>
              <strong>Analytics</strong>: cookies up to two years in your browser. Google Analytics
              keeps event-level data for no longer than 14 months.
            </li>
            <li>
              <strong>Server access logs</strong> (IP address, time, page, browser type): no longer
              than 30 days.
            </li>
            <li>
              <strong>Rating lookup cache</strong>: titles and scores only, no personal data;
              entries are refreshed after 7 days (1 day when no score was found).
            </li>
            <li>
              <strong>Payment and tax records</strong>: held by Paddle under its own retention
              rules. We keep only the ids and dates listed above.
            </li>
            <li>
              <strong>Emails to us</strong>: as long as needed to deal with your request.
            </li>
          </ul>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>International transfers</h2>
          <p>
            Google, Paddle, OMDb, jsDelivr and our hosting provider may process data outside the
            European Economic Area and the United Kingdom, including in the United States. Where
            that happens, the transfer relies on a safeguard the provider offers, such as the
            EU-US Data Privacy Framework or Standard Contractual Clauses.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Your rights</h2>
          <p>
            Depending on where you live, you have the right to access the personal data we hold
            about you, to have it corrected or deleted, to restrict or object to its processing, to
            receive it in a portable format, and to withdraw consent at any time (withdrawing does
            not affect what happened before). You also have the right to complain to a data
            protection supervisory authority, for example the one in your country of residence or,
            in the UK, the Information Commissioner&apos;s Office. To use any of these rights, email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We aim to answer within one
            month.
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
