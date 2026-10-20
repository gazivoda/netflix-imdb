import GuideLayout, { type Faq } from '../../../components/GuideLayout';
import g from '../../../components/guide.module.css';
import s from '../research.module.css';
import { AUTHOR_NAME, REPO_URL, SITE_URL } from '../../../lib/content';
import { authorRef, pageMetadata } from '../../../lib/seo';
import { getPage } from '../../../lib/pages';
import { summarize, toGapRow } from '../../../lib/research-stats';
import raw from '../../../data/imdb-rt-gap.json';

const PATH = '/research/imdb-vs-rotten-tomatoes-gap';
export const metadata = pageMetadata(PATH);

// Everything below is derived from the committed JSON at build time. No runtime API calls.
const DATA_PATH = '/data/imdb-rt-gap.json';
const DATA_URL = `${SITE_URL}${DATA_PATH}`;

interface Title {
  title: string;
  year: number;
  type: string;
  imdbId: string;
  imdbRating: number;
  imdbVotes: number | null;
  rtPercent: number;
}
const titles = raw.titles as Title[];
const flagged = raw.flagged;
const rows = titles
  .map((t) => ({ ...toGapRow({ title: t.title, imdb: t.imdbRating, rt: t.rtPercent }), year: t.year }))
  .sort((a, b) => b.gap - a.gap || a.title.localeCompare(b.title));
const stats = summarize(titles.map((t) => ({ title: t.title, imdb: t.imdbRating, rt: t.rtPercent })));
const statsClean = summarize(
  titles
    .filter((t) => !flagged.some((f) => f.title === t.title))
    .map((t) => ({ title: t.title, imdb: t.imdbRating, rt: t.rtPercent })),
);

const pct = (x: number) => `${Math.round(x * 100)}%`;
const bigCount = Math.round(stats.shareBigGap * stats.n);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const fetchedDate = fmtDate(raw.fetchedAt);
const isoDate = raw.fetchedAt.slice(0, 10);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const years = titles.map((t) => t.year);

const seriesExcluded = raw.excluded.filter((e) => e.type === 'series').length;
const seriesNoRt = raw.excluded.filter((e) => e.type === 'series' && /Rotten Tomatoes/.test(e.reason)).length;
const filmsExcluded = raw.excluded.filter((e) => e.type === 'movie');
const seriesTotal = seriesExcluded + titles.filter((t) => t.type === 'series').length;

const maxGap = Math.max(...rows.map((r) => Math.abs(r.gap)), 1);
const topCritics = rows.slice(0, 5);
const topAudience = [...rows].reverse().slice(0, 5);
const nameList = (rs: typeof rows) => rs.map((r) => `${r.title} (${signed(r.gap)})`).join(', ');

const FAQS: Faq[] = [
  {
    q: 'How big is the gap between IMDb and Rotten Tomatoes scores?',
    a: `For ${stats.n} Netflix Original films, the average absolute gap between the Rotten Tomatoes percentage and the IMDb rating multiplied by ten was ${stats.meanAbsGap} points, with a median of ${stats.medianAbsGap}. ${bigCount} of ${stats.n} films (${pct(stats.shareBigGap)}) differed by ${stats.bigGapThreshold} points or more. Scores come from OMDb as of ${fetchedDate}.`,
  },
  {
    q: 'Do critics or audiences rate Netflix films higher?',
    a: `Critics scored higher on Rotten Tomatoes than audiences did on IMDb for ${stats.criticsHigherCount} of ${stats.n} films; audiences scored higher for ${stats.audienceHigherCount}. The mean signed gap was ${signed(stats.meanSignedGap)} points. That compares a percentage of positive reviews with an average rating, so it is a pattern in this sample, not a verdict on quality.`,
  },
  {
    q: 'Are IMDb and Rotten Tomatoes scores correlated?',
    a: `Yes, strongly but imperfectly. Across these ${stats.n} films the Pearson correlation between IMDb (scaled to 100) and Rotten Tomatoes was r = ${stats.pearson}. Roughly half of the variation in one score lines up with the other, so a high score on one site usually predicts a high score on the other, with many exceptions.`,
  },
  {
    q: 'Why are TV series missing from the study?',
    a: `OMDb returned no Rotten Tomatoes score for any of the ${seriesTotal} Netflix series on the candidate list, which included Stranger Things, The Crown and Squid Game. Rather than mix in numbers from another source, the study covers films only. Series appear in the excluded list in the raw JSON file.`,
  },
  {
    q: 'Can I reproduce these numbers or reuse the data?',
    a: `Yes. The raw data is a single JSON file, and the repository includes the Node script that fetched it from OMDb, the fixed list of candidate titles, and the unit-tested statistics code. Re-running the script gives a fresh snapshot, so scores may differ from those published here because both sites change over time.`,
  },
];

const page = getPage(PATH);
const datasetNode = {
  '@type': 'Dataset',
  '@id': `${SITE_URL}${PATH}#dataset`,
  name: raw.name,
  description: `${raw.description} ${stats.n} films, snapshot of ${fetchedDate}.`,
  url: `${SITE_URL}${PATH}`,
  creator: { '@type': 'Person', '@id': authorRef['@id'], name: AUTHOR_NAME, url: REPO_URL },
  datePublished: page.published ?? isoDate,
  dateModified: isoDate,
  inLanguage: 'en',
  isAccessibleForFree: true,
  keywords: ['IMDb', 'Rotten Tomatoes', 'Netflix', 'ratings', 'critics vs audience', 'OMDb'],
  temporalCoverage: `${Math.min(...years)}/${Math.max(...years)}`,
  isBasedOn: 'https://www.omdbapi.com/',
  measurementTechnique:
    'Scores retrieved from the OMDb API for a fixed list of titles; IMDb rating multiplied by 10 and compared with the Rotten Tomatoes Tomatometer percentage.',
  variableMeasured: [
    { '@type': 'PropertyValue', name: 'imdbRating', description: 'IMDb average user rating, 0-10', minValue: 0, maxValue: 10 },
    { '@type': 'PropertyValue', name: 'rtPercent', description: 'Rotten Tomatoes Tomatometer, percent of positive critic reviews', unitText: 'percent', minValue: 0, maxValue: 100 },
  ],
  distribution: [
    {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: DATA_URL,
      name: 'imdb-rt-gap.json',
    },
  ],
};

export default function Page() {
  return (
    <GuideLayout
      path={PATH}
      h1="IMDb vs Rotten Tomatoes: how far apart are the scores on Netflix?"
      lede={
        <>
          <strong>
            Across {stats.n} Netflix Original films, IMDb and Rotten Tomatoes scores differ by{' '}
            {stats.meanAbsGap} points on average, and {pct(stats.shareBigGap)} of films differ by{' '}
            {stats.bigGapThreshold} points or more.
          </strong>{' '}
          Critics scored higher in {stats.criticsHigherCount} films and audiences in{' '}
          {stats.audienceHigherCount}. The two scores are correlated (r = {stats.pearson}) but far
          from interchangeable. Data from OMDb, snapshot of {fetchedDate}.
        </>
      }
      faqs={FAQS}
      schema={[datasetNode]}
    >
      <div className={s.stats}>
        <div className={`${s.stat} ${s.statInk}`}>
          <span className={s.statValue}>{stats.meanAbsGap}<span className={s.statUnit}>pts</span></span>
          <span className={s.statLabel}>Mean absolute gap (median {stats.medianAbsGap})</span>
        </div>
        <div className={`${s.stat} ${s.statGold}`}>
          <span className={s.statValue}>{pct(stats.shareBigGap)}</span>
          <span className={s.statLabel}>Films {stats.bigGapThreshold}+ points apart ({bigCount} of {stats.n})</span>
        </div>
        <div className={`${s.stat} ${s.statSignal}`}>
          <span className={s.statValue}>{stats.criticsHigherCount}:{stats.audienceHigherCount}</span>
          <span className={s.statLabel}>Critics higher : audience higher</span>
        </div>
        <div className={`${s.stat} ${s.statCard}`}>
          <span className={s.statValue}>{stats.pearson}</span>
          <span className={s.statLabel}>Pearson correlation (r)</span>
        </div>
      </div>

      <h2 className={g.h2}>What did the study find?</h2>
      <p className={g.p}>
        The typical Netflix Original film in this sample has an IMDb score (times ten) and a
        Rotten Tomatoes percentage that are about {stats.medianAbsGap} points apart. Only{' '}
        {stats.n - bigCount} of {stats.n} films were less than {stats.bigGapThreshold} points
        apart. Critics came out ahead more often ({stats.criticsHigherCount} films), but the average
        signed gap is small ({signed(stats.meanSignedGap)} points) because the biggest
        disagreements run both ways.
      </p>
      <ul className={g.list}>
        <li>
          <strong>Critics higher than audiences (largest gaps):</strong> {nameList(topCritics)}.
        </li>
        <li>
          <strong>Audiences higher than critics (largest gaps):</strong> {nameList(topAudience)}.
        </li>
      </ul>
      <p className={g.p}>
        A positive gap means the Rotten Tomatoes percentage is higher than the IMDb rating times
        ten. Scores on the two sites are different kinds of number, so a gap says the sites
        disagree about a film, not that either one is wrong. For how each score is built and when
        to lean on which, see{' '}
        <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes</a>.
      </p>

      <h2 className={g.h2}>How was the study done?</h2>
      <ul className={g.list}>
        <li>
          <strong>Selection rule:</strong> {raw.candidates} Netflix Original films and series that are widely
          discussed or award-winning, written into the script before any score was fetched. No
          title was added, dropped or swapped after seeing its result.
        </li>
        <li>
          <strong>Source:</strong> one OMDb API lookup per title ({raw.omdbRequests} requests in
          total), by title, release year and type. Responses are cached in the repository.
        </li>
        <li>
          <strong>Normalisation:</strong> IMDb rating &times; 10 puts both scores on a 0-100
          scale. Gap = Rotten Tomatoes % minus IMDb &times; 10.
        </li>
        <li>
          <strong>Statistics:</strong> mean and median of the absolute gap, the share of films
          with a gap of {stats.bigGapThreshold} points or more, and the Pearson correlation.
        </li>
        <li>
          <strong>Exclusions:</strong> {raw.excluded.length} of {raw.candidates} candidates have no
          usable pair. OMDb returned no Rotten Tomatoes score for {seriesNoRt} of the {seriesTotal}{' '}
          series, so the usable sample is films only.{' '}
          {filmsExcluded.length} films were dropped for a missing or unfound score (
          {filmsExcluded.map((f) => f.title).join(', ')}).
        </li>
      </ul>
      <p className={g.p}>
        Anyone can re-run it: the fixed title list and fetch script are in{' '}
        <a href={`${REPO_URL}/blob/main/${raw.script}`} target="_blank" rel="noopener noreferrer">
          {raw.script}
        </a>
        . The same OMDb database powers the{' '}
        <a href="/install">Rating Watch extension</a>, so these are the numbers it shows on
        Netflix cards.
      </p>

      <h2 className={g.h2}>What are the limitations?</h2>
      <ul className={g.list}>
        <li>
          <strong>Snapshot in time.</strong> Scores were fetched between{' '}
          {fmtDate(raw.fetchedFrom)} and {fetchedDate}. Both IMDb ratings and Rotten Tomatoes
          percentages move as more people vote and review, especially for recent releases.
        </li>
        <li>
          <strong>Not a representative sample.</strong> {stats.n} well-known Netflix Original
          films ({Math.min(...years)} to {Math.max(...years)}), picked for name recognition. It
          says nothing certain about all Netflix titles, licensed films, or TV.
        </li>
        <li>
          <strong>Different kinds of score.</strong> Rotten Tomatoes is a share of positive
          reviews; IMDb is an average vote. Scaling IMDb &times; 10 makes them comparable on paper,
          not equivalent.
        </li>
        <li className={s.slip}>
          <strong>OMDb can lag or err.</strong> On {fmtDate(flagged[0].checkedOn)} OMDb gave{' '}
          {flagged[0].title} a Rotten Tomatoes score of {flagged[0].omdbRtPercent}%, while{' '}
          <a href={flagged[0].checkedUrl} target="_blank" rel="noopener noreferrer">
            the Rotten Tomatoes page
          </a>{' '}
          showed {flagged[0].rtSitePercent}% from {flagged[0].rtSiteReviews} reviews. The table keeps
          OMDb&apos;s value, because the study measures what OMDb serves. Without that one film (n ={' '}
          {statsClean.n}) the mean absolute gap is {statsClean.meanAbsGap}, the median{' '}
          {statsClean.medianAbsGap}, {pct(statsClean.shareBigGap)} differ by{' '}
          {stats.bigGapThreshold}+ points and r = {statsClean.pearson}. Only this largest outlier
          was checked by hand; the other values are unverified.
        </li>
      </ul>

      <h2 className={g.h2}>What does the data look like?</h2>
      <p className={g.p}>
        All {stats.n} films, sorted from the biggest &ldquo;critics higher&rdquo; gap to the
        biggest &ldquo;audience higher&rdquo; gap. Scores as returned by OMDb on {fetchedDate}.
      </p>
      <div
        className={s.ledger}
        role="region"
        tabIndex={0}
        aria-label={`IMDb and Rotten Tomatoes scores for ${stats.n} Netflix Original films`}
      >
        <table className={s.dataTable} aria-label={`IMDb and Rotten Tomatoes scores for ${stats.n} Netflix Original films`}>
          <thead>
            <tr>
              <th scope="col">Film</th>
              <th scope="col" className={s.num}><span className={s.thImdb}>IMDb</span></th>
              <th scope="col" className={s.num}>IMDb &times; 10</th>
              <th scope="col" className={s.num}><span className={s.thRt}>RT %</span></th>
              <th scope="col">Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isFlagged = flagged.some((f) => f.title === r.title);
              return (
                <tr key={r.title}>
                  <th scope="row">
                    {r.title} <span className={s.year}>({r.year})</span>
                    {isFlagged && <span title="OMDb value differs from rottentomatoes.com; see limitations"> *</span>}
                  </th>
                  <td className={s.num}>{r.imdb.toFixed(1)}</td>
                  <td className={s.num}>{r.imdbScaled}</td>
                  <td className={s.num}>{r.rt}</td>
                  <td className={s.gapCell}>
                    <span className={s.gapVal}>{signed(r.gap)}</span>
                    <span className={s.bar} aria-hidden>
                      <span
                        className={r.gap > 0 ? s.barPos : s.barNeg}
                        style={{ width: `${(Math.abs(r.gap) / maxGap) * 50}%` }}
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={`${g.p} ${s.small}`}>
        Gap in points: positive = Rotten Tomatoes higher, negative = IMDb (&times; 10) higher. * =
        OMDb value differs from the Rotten Tomatoes page (see limitations).
      </p>

      <h2 className={g.h2}>Where can I get the data?</h2>
      <p className={g.p}>
        The raw data is one JSON file: every included film with its IMDb ID, scores and vote
        count, the excluded titles with reasons, the selection rule, the fetch date and the
        computed summary. Cite it as {AUTHOR_NAME}, &ldquo;{raw.name}&rdquo;, Rating Watch,{' '}
        {fetchedDate}.
      </p>
      <p>
        <a className={`ds-btn ${s.download}`} href={DATA_PATH} download>
          Download imdb-rt-gap.json
        </a>
      </p>
      <p className={g.p}>
        Want both scores while you browse? <a href="/install">Install Rating Watch</a>, a free,
        open-source extension that shows IMDb and Rotten Tomatoes on every Netflix title card. It
        is not affiliated with Netflix, IMDb or Rotten Tomatoes.
      </p>
    </GuideLayout>
  );
}
