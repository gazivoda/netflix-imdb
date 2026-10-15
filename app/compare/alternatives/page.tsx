import type { ReactNode } from 'react';
import g from '../../../components/guide.module.css';
import GuideLayout, { type Faq } from '../../../components/GuideLayout';
import { REPO_URL } from '../../../lib/content';
import { absoluteUrl, pageMetadata } from '../../../lib/seo';

const PATH = '/compare/alternatives';
export const metadata = pageMetadata(PATH);

// Every third-party claim below was read on the cited page on 2026-10-15.
// Where a page did not say something, the table says "not stated", never a guess.
const SRC = {
  justwatch: 'https://www.justwatch.com/us',
  justwatchTv: 'https://www.justwatch.com/us/tv-shows',
  reelgood: 'https://apps.apple.com/app/id1031391869',
  imdbHelp: 'https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV',
  rt: 'https://www.rottentomatoes.com',
  rtAbout: 'https://www.rottentomatoes.com/about',
  rateflix: 'https://chromewebstore.google.com/detail/ebldhbkjcdliijniaheecfjojdhjlaji',
  overlay: 'https://www.chromeboard.com/extension/netflix-imdb-overlay-cnhpjpnmjlgcpkdngmdoembbdgiobodc',
};

const ext = (href: string, text: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>
);

interface Row {
  name: string;
  /** Only used for the ItemList JSON-LD. */
  url: string;
  what: ReactNode;
  where: ReactNode;
  tab: ReactNode;
  cost: ReactNode;
  oss: ReactNode;
}

const ROWS: Row[] = [
  {
    name: 'Netflix Ratings',
    url: absoluteUrl('/'),
    what: 'Chrome extension that adds IMDb and Rotten Tomatoes scores to Netflix.',
    where: 'A badge on each title card on netflix.com.',
    tab: 'No.',
    cost: 'Free, no account. Installs as an unpacked extension (not on the Chrome Web Store yet).',
    oss: <>Yes, <a href={REPO_URL} target="_blank" rel="noopener noreferrer">on GitHub</a>.</>,
  },
  {
    name: 'JustWatch',
    url: SRC.justwatch,
    what: <>A streaming guide: {ext(SRC.justwatch, 'where to watch')} movies and shows in your country.</>,
    where: <>On JustWatch itself. It mentions {ext(SRC.justwatchTv, 'filtering by IMDb rating')}; I found no Rotten Tomatoes mention on the pages I read.</>,
    tab: 'Yes, it is its own site and apps.',
    cost: 'Has a Sign In link; price is not stated on the pages I read.',
    oss: 'Not stated.',
  },
  {
    name: 'Reelgood',
    url: SRC.reelgood,
    what: <>An app to {ext(SRC.reelgood, 'find what to watch and where')} across streaming services.</>,
    where: <>In the Reelgood app and site. Its App Store listing says &quot;IMDb scores and Reelgood scores guide you&quot;; Rotten Tomatoes is not mentioned there.</>,
    tab: 'Yes, it is its own app and site.',
    cost: 'Listed as Free on the App Store, which also lists an email address among data linked to you.',
    oss: 'Not stated.',
  },
  {
    name: 'IMDb',
    url: SRC.imdbHelp,
    what: <>A title database. Its score is {ext(SRC.imdbHelp, 'a weighted average of 1 to 10 ratings')} from registered users.</>,
    where: 'On each title page at imdb.com.',
    tab: 'Yes, you look the title up.',
    cost: 'Rating a title needs a registered account; I could not load the IMDb homepage to check anything else.',
    oss: 'Not stated.',
  },
  {
    name: 'Rotten Tomatoes',
    url: SRC.rt,
    what: <>A review site. The Tomatometer is {ext(SRC.rtAbout, 'the percentage of professional critic reviews that are positive')}.</>,
    where: <>On rottentomatoes.com. Its {ext(SRC.rt, 'home page')} also has sections for titles on Netflix and other services.</>,
    tab: 'Yes, you look the title up.',
    cost: 'Free movies are promoted with "No log in required"; it has a Login/signup link.',
    oss: 'Not stated.',
  },
  {
    name: 'RateFlix',
    url: SRC.rateflix,
    what: <>Chrome extension that {ext(SRC.rateflix, 'displays IMDb and Rotten Tomatoes ratings on Netflix titles')}.</>,
    where: 'On Netflix titles (the listing does not say where exactly).',
    tab: 'No.',
    cost: 'Chrome Web Store listing shows no price; it says no personal data is collected.',
    oss: 'Not stated.',
  },
  {
    name: 'Netflix IMDb Overlay',
    url: SRC.overlay,
    what: <>Extension that {ext(SRC.overlay, 'overlays IMDb ratings on Netflix thumbnails')}.</>,
    where: 'On Netflix thumbnails; IMDb only.',
    tab: 'No.',
    cost: 'You must first get your own free OMDb API key. Price of the extension itself is not stated.',
    oss: 'Not stated.',
  },
];

const FAQS: Faq[] = [
  {
    q: 'What is the easiest way to see IMDb and Rotten Tomatoes ratings on Netflix?',
    a: 'Use a browser extension that puts the scores on the Netflix title cards, so you do not leave the page. Netflix Ratings does this for Chrome, Edge and Brave: it adds IMDb and Rotten Tomatoes badges to cards on netflix.com, needs no account and asks for no API key. Sites like IMDb require a separate tab per title.',
  },
  {
    q: 'Is Reelgood or JustWatch better than a ratings extension?',
    a: 'They do a different job. Reelgood and JustWatch are streaming guides that tell you where a title is available and let you track what to watch across services. A ratings extension only adds scores to Netflix itself. If you subscribe to several services, a guide is more useful; if you mostly browse Netflix, an extension saves more clicks.',
  },
  {
    q: 'Are there other Chrome extensions that add ratings to Netflix?',
    a: 'Yes. On 2026-10-15 I found RateFlix, which lists IMDb and Rotten Tomatoes ratings on Netflix titles, and Netflix IMDb Overlay, which shows IMDb ratings only and needs your own free OMDb API key. Both listings were thin on details such as source code, so check reviews and permissions before installing any of them.',
  },
  {
    q: 'Is Netflix Ratings on the Chrome Web Store?',
    a: 'Not yet. It installs as an unpacked extension from GitHub, which takes about a minute in Chrome, Edge or Brave. If you want one-click installation from the store today, a store-listed alternative such as RateFlix is easier, though I have not verified its source code or how it fetches ratings.',
  },
  {
    q: 'Are these services affiliated with Netflix Ratings?',
    a: 'No. Netflix Ratings is an independent project and is not affiliated with Netflix, IMDb, Rotten Tomatoes, JustWatch, Reelgood, RateFlix or any other product named here. All names belong to their owners and are used only to identify the products being compared.',
  },
];

const itemList = {
  '@type': 'ItemList',
  name: 'Ways to see ratings while browsing Netflix',
  itemListOrder: 'https://schema.org/ItemListUnordered',
  numberOfItems: ROWS.length,
  itemListElement: ROWS.map((r, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: r.name,
    url: r.url,
  })),
};

export default function AlternativesPage() {
  return (
    <GuideLayout
      path={PATH}
      h1="Ways to See Ratings on Netflix: Alternatives Compared"
      crumbs={[{ name: 'Compare', path: '/compare/imdb-vs-rotten-tomatoes' }]}
      schema={[itemList]}
      faqs={FAQS}
      lede={
        <>
          <strong>
            To see ratings on Netflix you can use a streaming guide such as JustWatch or Reelgood,
            look titles up on IMDb or Rotten Tomatoes, or install an extension that puts the scores
            on the cards.
          </strong>{' '}
          Netflix Ratings is one of those extensions, so this page compares it fairly, including
          where another option is the better pick.
        </>
      }
    >
      <p className={g.note}>
        <strong>Last verified: 2026-10-15.</strong> Every claim about another product comes from
        the page linked beside it, read on that date. Where a page said nothing, the table says
        &quot;not stated&quot;. reelgood.com and imdb.com refused my automated requests, so Reelgood is
        described from its App Store listing and IMDb from its help page. Things change; check the
        source before you decide.
      </p>

      <h2 className={g.h2}>How do the options compare?</h2>
      <div className={g.tableWrap}>
        <table className={g.table}>
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">What it is</th>
              <th scope="col">Where you see ratings</th>
              <th scope="col">Needs another tab?</th>
              <th scope="col">Account / price</th>
              <th scope="col">Open source</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td>{r.what}</td>
                <td>{r.where}</td>
                <td>{r.tab}</td>
                <td>{r.cost}</td>
                <td>{r.oss}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={g.h2}>When is Netflix Ratings the right choice?</h2>
      <p className={g.p}>
        When you mostly browse Netflix and want the audience score (IMDb, out of 10) and the critic
        score (Rotten Tomatoes, a percentage) on every card without opening anything else. It has no
        account and no key to enter, and its source is public so you can read what it does. Not sure
        how the two scores differ? See{' '}
        <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes</a>.
      </p>

      <h2 className={g.h2}>When is another option better?</h2>
      <ul className={g.list}>
        <li>
          <strong>You want to know where something is streaming.</strong> JustWatch and Reelgood are
          built for that across services. Netflix Ratings only works on netflix.com.
        </li>
        <li>
          <strong>You want more than a number.</strong> IMDb and Rotten Tomatoes have the full
          pages: user ratings, critic reviews and the definitions behind each score.
        </li>
        <li>
          <strong>You want a store install today.</strong> RateFlix is{' '}
          {ext(SRC.rateflix, 'listed on the Chrome Web Store')}, while Netflix Ratings still needs
          the <a href="/install">Load unpacked steps</a>.
        </li>
        <li>
          <strong>You use another browser.</strong> Netflix Ratings targets Chromium browsers and is
          untested in Firefox and Safari.
        </li>
      </ul>

      <p className={g.p}>
        A note on the other extensions: {ext(SRC.rateflix, 'RateFlix')} showed 17 users and{' '}
        {ext(SRC.overlay, 'Netflix IMDb Overlay')} 105 users on the day I checked, so both are
        young and small. That says nothing about quality, but there is little track record either
        way.
      </p>

      <aside className={g.callout}>
        <h2 className={g.calloutTitle}>Try it on your own Netflix</h2>
        <p>
          Netflix Ratings is free and installs in about a minute. It is independent and not
          affiliated with Netflix, IMDb or Rotten Tomatoes.
        </p>
        <a href="/install" className={g.btnPrimary}>
          How to install <span aria-hidden>→</span>
        </a>
      </aside>
    </GuideLayout>
  );
}
