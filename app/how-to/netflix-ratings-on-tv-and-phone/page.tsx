import GuideLayout, { type Faq } from '../../../components/GuideLayout';
import g from '../../../components/guide.module.css';
import { CHROME_WEB_STORE_URL } from '../../../lib/content';
import { PRO_ON_SALE } from '../../../lib/billing/flag';
import { pageMetadata } from '../../../lib/seo';

const PATH = '/how-to/netflix-ratings-on-tv-and-phone';
export const metadata = pageMetadata(PATH);

// Every third-party fact below was read on the cited page on 2026-11-06 (the Netflix help page, the Mac App Store
// listing, the Firefox add-on page and the Technipages guide). Rating Watch's own support comes from
// extension/manifest.json and README.md: desktop Chromium only, untested in Firefox and Safari.
const SRC = {
  netflixRatings: 'https://help.netflix.com/en/node/9898',
  popcorn: 'https://apps.apple.com/us/app/id1535719670',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/imdb-ratings-on-netflix/',
  android: 'https://www.technipages.com/imdb-ratings-netflix-android',
};

// While Pro is not on sale (build-time flag), AR mode is described as free to try and no trial or price is promised.
const AR_AVAILABILITY = PRO_ON_SALE
  ? 'AR mode is part of Rating Watch Pro and asks you to sign in with Google.'
  : 'AR mode is free to try for now.';

const FAQS: Faq[] = [
  {
    q: 'Can I see IMDb ratings in the Netflix app on my phone?',
    a: 'Not with Rating Watch. Its extension runs on netflix.com in desktop Chrome, Edge and Brave and does not run inside the Netflix app on phones or tablets. There is no phone version. You can look a title up on imdb.com in your phone browser, or use AR mode with your phone as a camera pointed at a TV.',
    aNode: <>Not with Rating Watch. Its extension runs on netflix.com in desktop Chrome, Edge and Brave and does not run inside the Netflix app on phones or tablets. There is no phone version. You can look a title up on imdb.com in your phone browser, or use <a href="/camera-vision/ar">AR mode</a> with your phone as a camera pointed at a TV.</>,
  },
  {
    q: 'Can I get IMDb ratings on a Netflix smart TV?',
    a: 'A browser extension cannot be installed in the Netflix TV app, so no extension adds scores there. Rating Watch offers AR mode instead: you open it on your phone, point the rear camera at the TV and it draws IMDb and Rotten Tomatoes scores over the title cards it can read. It is experimental, so some cards may stay unlabelled.',
    aNode: <>A browser extension cannot be installed in the Netflix TV app, so no extension adds scores there. Rating Watch offers <a href="/camera-vision/ar">AR mode</a> instead: you open it on your phone, point the rear camera at the TV and it draws IMDb and Rotten Tomatoes scores over the title cards it can read. It is experimental, so some cards may stay unlabelled.</>,
  },
  {
    q: 'Does Rating Watch work in Safari or Firefox?',
    a: 'No. Rating Watch is a Manifest V3 Chromium extension and has not been tested in Firefox or Safari, so only Chrome, Edge and Brave on a computer are supported. Other makers offer Safari and Firefox extensions. This page names two with the dates and figures read on 2026-11-06, but Rating Watch has not tested either of them.',
  },
  {
    q: 'Does Netflix show Rotten Tomatoes scores anywhere?',
    a: 'Netflix\'s rating help page describes thumbs up, thumbs down, double thumbs up and a Most Liked label. It does not describe IMDb or Rotten Tomatoes scores. To see Rotten Tomatoes next to Netflix titles on a computer, use an extension; Rating Watch shows the Tomatometer where OMDb has one, mostly for films rather than TV series.',
  },
];

export default function NetflixRatingsOnTvAndPhonePage() {
  return (
    <GuideLayout
      path={PATH}
      h1="IMDb ratings on Netflix: what works on TV, phone and Safari"
      lede={
        <>
          <strong>
            Netflix&apos;s own ratings are thumbs and a Most Liked label, not IMDb or Rotten Tomatoes
            scores.
          </strong>{' '}
          IMDb scores reach Netflix through browser extensions, and Rating Watch works in desktop
          Chrome, Edge and Brave. Smart TV and phone apps run no extensions, so for those there is AR
          mode, which reads a TV through your phone camera.
        </>
      }
      faqs={FAQS}
      faqSchema={false}
    >
      <h2 className={g.h2}>Does Netflix show IMDb or Rotten Tomatoes ratings on any device?</h2>
      <p className={g.p}>
        Netflix&apos;s <a href={SRC.netflixRatings}>rating help page</a> describes thumbs down, thumbs up
        and double thumbs up, plus a Most Liked label for titles with the most positive ratings. It adds
        that some older devices may show stars instead of thumbs. It does not describe IMDb or Rotten
        Tomatoes scores, so what you see depends on a tool that adds them. What each Netflix label means
        is covered in <a href="/how-to/netflix-ratings-explained">Netflix ratings explained</a>.
      </p>

      <h2 className={g.h2}>On a computer: Chrome, Edge and Brave</h2>
      <p className={g.p}>
        This is where Rating Watch works. It adds a badge to the top-right corner of title cards on
        netflix.com with the IMDb rating and, where OMDb has one, the Rotten Tomatoes score. It is free,
        needs no account and is built for desktop Chrome, Edge and Brave. It starts on a shared OMDb
        lookup allowance that can run out on a busy day; a free personal OMDb key lifts the limit. The
        step-by-step setup is in{' '}
        <a href="/how-to/show-imdb-ratings-on-netflix">how to show IMDb ratings on Netflix</a>, and the{' '}
        <a href="/install">install guide</a> covers permissions and fixes.
      </p>
      <div className={g.callout}>
        <p className={g.calloutTitle}>Get the badges on your computer</p>
        <p>Install from the Chrome Web Store, open netflix.com and browse.</p>
        <a href={CHROME_WEB_STORE_URL} className={g.btnPrimary}>Add to Chrome</a>
      </div>

      <h2 className={g.h2}>On a Mac with Safari, or in Firefox</h2>
      <p className={g.p}>
        Rating Watch is a Manifest V3 Chromium extension and has not been tested in Firefox or Safari, so
        it is not supported there. Other developers publish extensions for those browsers. These are the
        facts from their own pages, read on 2026-11-06. Rating Watch has not tested either one, and
        neither is affiliated with it.
      </p>
      <ul className={g.list}>
        <li>
          <strong>Safari on a Mac:</strong> the <a href={SRC.popcorn}>Popcorn for Safari</a> Mac App Store
          listing says it is for Mac only, needs macOS 11.0 or later and Safari 14 or later, and shows
          IMDb, Metascore and Rotten Tomatoes ratings. It is listed as free with optional in-app tips.
          Its latest version is 3.0, dated 14 October 2022.
        </li>
        <li>
          <strong>Firefox:</strong> the <a href={SRC.firefox}>IMDb ratings on Netflix</a> add-on by
          Pawannitj lists IMDb, Rotten Tomatoes and Metacritic. Its last update was 25 September 2020
          (version 0.149), and it showed 401 users and a 2.8 average from 24 ratings. An old update date
          does not prove it is broken, but it predates today&apos;s Netflix pages.
        </li>
      </ul>
      <p className={g.p}>
        More browser extensions, with the same kind of dated facts, are in the{' '}
        <a href="/compare/alternatives">comparison of Netflix ratings extensions</a>.
      </p>

      <h2 className={g.h2}>On a smart TV, Fire TV or game console</h2>
      <p className={g.p}>
        Browser extensions cannot be installed in the Netflix TV app, so no extension adds scores there.
        Rating Watch&apos;s answer is <a href="/camera-vision/ar">AR mode (it may ask you to sign in)</a>:
        open it on your phone, start the rear camera, open a title card on the TV and hold the phone
        about 1 to 2 metres away. It reads the title with your phone and draws IMDb and Rotten Tomatoes
        scores over the card. Camera images are processed on your device. {AR_AVAILABILITY}
      </p>
      <p className={g.p}>
        AR mode is experimental. It has been tuned on test images and is not yet measured across many
        real TVs, so some cards may stay unlabelled and scores can be missing. It is a companion to
        the extension, not a replacement for it. See <a href="/pricing">pricing</a> for the current
        terms.
      </p>

      <h2 className={g.h2}>On an iPhone, iPad or Android phone</h2>
      <p className={g.p}>
        Rating Watch does not run inside the Netflix app on phones or tablets, and there is no phone
        version of it. Your phone can serve as the camera for AR mode on a TV, but AR mode does not add
        scores inside the phone&apos;s own Netflix app. The simplest reliable route is to look the title
        up on imdb.com or rottentomatoes.com.
      </p>
      <p className={g.p}>
        For Android, a <a href={SRC.android}>Technipages guide dated 10 November 2020</a> describes
        installing an app that needs accessibility access to show IMDb ratings. I did not check whether
        that app is still available or works with today&apos;s Netflix app, and Rating Watch does not
        recommend it. Accessibility access is a broad permission, so read an app&apos;s listing and
        permissions before granting it.
      </p>

      <h2 className={g.h2}>Which device gets what?</h2>
      <div className={g.tableWrap} role="region" aria-label="IMDb ratings on Netflix by device, compared" tabIndex={0}>
        <table className={g.table}>
          <caption>What can add IMDb scores to Netflix on each device</caption>
          <thead>
            <tr>
              <th scope="col">Device or browser</th>
              <th scope="col">What can add scores</th>
              <th scope="col">Rating Watch</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Computer with Chrome, Edge or Brave</th>
              <td>Browser extensions</td>
              <td>Yes: IMDb and Rotten Tomatoes badges on title cards</td>
            </tr>
            <tr>
              <th scope="row">Mac with Safari</th>
              <td>Popcorn for Safari, per its 2022 listing</td>
              <td>Not tested, not supported</td>
            </tr>
            <tr>
              <th scope="row">Firefox</th>
              <td>An add-on last updated in 2020</td>
              <td>Not tested, not supported</td>
            </tr>
            <tr>
              <th scope="row">Smart TV, Fire TV or game console</th>
              <td>No extensions in the Netflix TV app</td>
              <td>AR mode through a phone camera (experimental)</td>
            </tr>
            <tr>
              <th scope="row">iPhone, iPad or Android phone</th>
              <td>Looking the title up separately; a 2020 Android guide used an accessibility app (not checked)</td>
              <td>No phone version; the phone can act as the AR mode camera</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className={g.note}>
        Sources read on November 6, 2026. Store pages, user counts and Netflix&apos;s apps change, so
        check the linked page before you decide. Rating Watch is independent and is not affiliated with
        Netflix, IMDb, Rotten Tomatoes or the other products named here.
      </p>
    </GuideLayout>
  );
}
