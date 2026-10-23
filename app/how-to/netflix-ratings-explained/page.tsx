import GuideLayout, { type Faq } from '../../../components/GuideLayout';
import g from '../../../components/guide.module.css';
import { CHROME_WEB_STORE_URL } from '../../../lib/content';
import { BLOG_HUB } from '../../../lib/blog/registry.generated';
import { pageMetadata } from '../../../lib/seo';

const PATH = '/how-to/netflix-ratings-explained';
export const metadata = pageMetadata(PATH);

const FAQS: Faq[] = [
  {
    q: 'Is a Netflix Match percentage an IMDb rating?',
    a: 'No. Netflix introduced Match as a personalized prediction, while IMDb summarizes ratings submitted by its users. A Match percentage and an IMDb score answer different questions, so multiplying IMDb by ten does not make the two equivalent. Netflix interfaces also change; you may see recommendation icons instead of a percentage.',
  },
  {
    q: 'Does TV-MA mean a Netflix show is highly rated?',
    a: 'No. TV-MA is a maturity classification for adult audiences, not a review score. Check the content advisories to understand the reason for the classification. Maturity labels can vary by country, and a series detail page may show its highest maturity level rather than the classification of one episode.',
  },
  {
    q: 'Can I add IMDb ratings to the Netflix TV app?',
    a: 'The Rating Watch extension works on netflix.com in a supported desktop Chromium browser, such as Chrome, Edge or Brave. It does not install inside the Netflix smart TV or phone app. For a TV, you can look up a title separately; the experimental camera demo offers another way to look up available scores.',
    aNode: <>The Rating Watch extension works on netflix.com in a supported desktop Chromium browser, such as Chrome, Edge or Brave. It does not install inside the Netflix smart TV or phone app. For a TV, you can look up a title separately; the experimental <a href="/camera-vision">camera demo</a> offers another way to look up available scores.</>,
  },
];

export default function NetflixRatingsExplainedPage() {
  return (
    <GuideLayout
      path={PATH}
      h1="Netflix ratings explained: thumbs, Match and age labels"
      lede={
        <>
          <strong>Netflix recommendations, maturity labels and independent review scores measure different things.</strong>{' '}
          Thumbs help personalize suggestions; a Match percentage, where shown, predicts your interest;
          an age label describes content suitability. IMDb and Rotten Tomatoes offer separate audience
          and critic signals. Use the right one for the decision you are making.
        </>
      }
      faqs={FAQS}
      faqSchema={false}
    >
      <h2 className={g.h2}>Which kind of rating are you looking at?</h2>
      <div className={g.tableWrap} role="region" aria-label="Netflix rating systems compared" tabIndex={0}>
        <table className={g.table}>
          <caption>What each label helps you decide</caption>
          <thead><tr><th scope="col">Label</th><th scope="col">What it measures</th><th scope="col">Use it for</th></tr></thead>
          <tbody>
            <tr><th scope="row">Thumbs</th><td>Your feedback to Netflix</td><td>Shaping your recommendations</td></tr>
            <tr><th scope="row">Match, where shown</th><td>Predicted fit for your profile</td><td>Finding something suited to your tastes</td></tr>
            <tr><th scope="row">TV-MA, PG-13 and similar</th><td>Maturity and content classification</td><td>Checking suitability for the viewer</td></tr>
            <tr><th scope="row">IMDb</th><td>Aggregated user ratings out of 10</td><td>Checking audience opinion</td></tr>
            <tr><th scope="row">Rotten Tomatoes Tomatometer</th><td>Percentage of positive critic reviews</td><td>Checking how broadly critics approved</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className={g.h2}>What do Netflix thumbs and Most Liked mean?</h2>
      <p className={g.p}>
        Netflix lets you mark a title with a thumbs down, thumbs up or double thumbs up.
        These choices tell Netflix about your preferences. Its{' '}
        <a href="https://help.netflix.com/en/node/9898">rating help page</a> also explains that
        titles receiving the most positive feedback get a Most Liked label. Neither label is
        an IMDb score or a Rotten Tomatoes critic percentage.
      </p>

      <h2 className={g.h2}>What does a Netflix Match percentage mean?</h2>
      <p className={g.p}>
        If you see a percentage such as 98% Match, read it as a prediction about your taste,
        not as the percentage of viewers who enjoyed the film. Netflix described this meaning
        in its <a href="https://about.netflix.com/en/news/goodbye-stars-hello-thumbs">2017 introduction of Match</a>.
        That announcement explains the term; it does not establish what every current app displays.
      </p>
      <p className={g.p}>
        Netflix&apos;s <a href="https://help.netflix.com/en/node/100639">current recommendation guide</a>{' '}
        describes predictions based on viewing history, feedback, similar tastes and information
        about titles. Different profiles can therefore get different suggestions for the same film.
        Its current rating guide also describes a double thumbs up recommendation icon, so do
        not expect a Match percentage on every device.
      </p>

      <h2 className={g.h2}>Are TV-MA and PG-13 quality scores?</h2>
      <p className={g.p}>
        No. A maturity rating addresses who the content is suitable for. Netflix or a local
        classification body sets it; the accompanying advisories describe themes such as violence
        or language. Read these before choosing something for children, regardless of how well
        the film scores with critics. Netflix&apos;s{' '}
        <a href="https://help.netflix.com/en/node/2064">maturity ratings guide</a> explains the
        country-specific labels and profile controls.
      </p>

      <h2 className={g.h2}>How are IMDb and Rotten Tomatoes different?</h2>
      <p className={g.p}>
        <a href="https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV">IMDb combines user ratings</a>{' '}
        into a score out of ten. The{' '}
        <a href="https://www.rottentomatoes.com/about">Rotten Tomatoes Tomatometer</a> counts
        the share of critic reviews that are positive. An 80% Tomatometer is not an average
        review of 8 out of 10. Our <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes comparison</a>{' '}
        explains how to read disagreements.
        {BLOG_HUB.ready && <> The <a href="/blog">100-film dataset</a> lets you compare real examples with dated source values.</>}
      </p>

      <h2 className={g.h2}>How do I see independent scores while browsing Netflix?</h2>
      <p className={g.p}>
        On a desktop computer, Rating Watch adds available IMDb and Rotten Tomatoes scores to
        Netflix title cards in Chrome, Edge or Brave. The extension is free and needs no account.
        It gets third-party scores from OMDb; some titles have only one score or none, and cached
        values can differ from the source sites. It does not change Netflix&apos;s maturity settings
        or calculate a replacement Match percentage.
      </p>
      <div className={g.callout}>
        <p className={g.calloutTitle}>Compare before you press play</p>
        <p>Install from the store, open netflix.com and browse. The <a href="/install">installation guide</a> covers permissions and missing badges.</p>
        <a href={CHROME_WEB_STORE_URL} className={g.btnPrimary}>Add to Chrome</a>
      </div>
      <p className={g.p}>
        Follow the <a href="/how-to/show-imdb-ratings-on-netflix">IMDb setup guide</a> or the{' '}
        <a href="/how-to/show-rotten-tomatoes-on-netflix">Rotten Tomatoes setup guide</a> for details.
        If you already understand the numbers, try the{' '}
        <a href="/how-to/find-what-to-watch-on-netflix">short routine for choosing what to watch</a>.
      </p>
      <p className={g.note}>
        Sources checked October 23, 2026. Interface labels vary by device and can change.
        Rating Watch is independent and is not affiliated with Netflix, IMDb or Rotten Tomatoes.
      </p>
    </GuideLayout>
  );
}
