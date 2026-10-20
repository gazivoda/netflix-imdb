import { existsSync } from 'fs';
import { join } from 'path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GuideLayout from '../../components/GuideLayout';
import g from '../../components/guide.module.css';
import s from './blog.module.css';
import { getBlogData, type BlogData } from './_lib/data';
import {
  ARCHETYPE_HEADING,
  ARCHETYPE_ORDER,
  excludedByReason,
  excludedRows,
  gapText,
  genreRows,
  hubSummary,
  masterRowsHtml,
  periodRows,
  topByArchetype,
} from './_lib/hub-view';
import { AUTHOR_NAME, SITE_URL, SUPPORT_EMAIL } from '../../lib/content';
import { formatAsOf, formatSigned } from '../../lib/blog/format';
import { articleLabel, displayTitle } from '../../lib/blog/title';
import { getPage } from '../../lib/pages';
import { BLOG_HUB } from '../../lib/blog/registry.generated';
import {
  BLOG_DATASET_DESCRIPTION,
  BLOG_DATASET_ID,
  BLOG_DATASET_NAME,
  absoluteUrl,
  authorRef,
  nodeId,
  pageMetadata,
} from '../../lib/seo';

const PATH = '/blog';

// I9: the hub goes public only when the generated registry says it is ready (films.json holds the
// expected number of films). Until then /blog is not in lib/pages.ts, so it must not be prerendered
// either (validate-seo fails on a prerendered page outside the registry, and a thin placeholder must
// not be indexed): the route is rendered on request and answers 404. notFound() alone is not enough,
// because Next 14 still prerenders a static route that calls it (blog.html with status 404).
// A ready hub is forced static ('auto' built it as dynamic in a scratch build); it reads no request data.
export const dynamic = BLOG_HUB.ready ? 'force-static' : 'force-dynamic';

export function generateMetadata(): Metadata {
  return BLOG_HUB.ready ? pageMetadata(PATH) : {};
}

const DATA_PATH = '/data/netflix-top-100.json';
const OMDB_URL = 'https://www.omdbapi.com/';
const NETFLIX_TOP10 = 'https://www.netflix.com/tudum/top10';
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const dataFileExists = () => existsSync(join(process.cwd(), 'public', DATA_PATH));

function itemListNode(data: BlogData) {
  return {
    '@type': 'ItemList',
    '@id': nodeId(PATH, 'list'),
    name: 'Film analyses',
    itemListElement: data.publishedSlugs.map((slug, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/blog/${slug}`),
    })),
  };
}

function datasetNode(data: BlogData) {
  const page = getPage(PATH);
  const net = data.filmsFile.netflix;
  return {
    '@type': 'Dataset',
    '@id': BLOG_DATASET_ID,
    name: BLOG_DATASET_NAME,
    description: BLOG_DATASET_DESCRIPTION,
    url: absoluteUrl(PATH),
    creator: { '@type': 'Person', '@id': authorRef['@id'], name: AUTHOR_NAME, url: `${SITE_URL}/about` },
    datePublished: page.published ?? page.updated,
    dateModified: page.updated,
    inLanguage: 'en',
    isAccessibleForFree: true,
    keywords: ['IMDb', 'Rotten Tomatoes', 'Netflix', 'ratings', 'critics vs audience', 'OMDb'],
    temporalCoverage: `${net.firstWeek}/${net.lastWeek}`,
    isBasedOn: OMDB_URL,
    measurementTechnique:
      'Films ranked by hours viewed in the Netflix global weekly Top 10 and Most Popular lists; scores retrieved from the OMDb API. Gap = Rotten Tomatoes percentage minus the IMDb rating multiplied by ten.',
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE_URL}${DATA_PATH}`, name: 'netflix-top-100.json' },
    ],
  };
}

function HowArticlesAreMade() {
  return (
    <>
      <h2 className={g.h2} id="how-articles-are-made">How are these articles made?</h2>
      <ul className={g.list}>
        <li>
          <strong>Numbers come from data, not from the text.</strong> Every score, vote count and rank in an article is
          filled in from the data file, so the writing cannot contradict the tables.
        </li>
        <li>
          <strong>AI-assisted, fact-checked.</strong> The articles are drafted with AI assistance. Each one is then
          fact-checked against the data and the cited sources, and any claim that cannot be supported is cut before
          it is published.
        </li>
        <li>
          <strong>Scores can be wrong.</strong> OMDb relays IMDb and Rotten Tomatoes values, and they can lag or err.
          For the widest gaps and for films with few votes, the Rotten Tomatoes page is checked by hand. If it differs
          by 10 points or more, or the check cannot be completed, the article is not published.
        </li>
        <li>
          <strong>Only facts we can source.</strong> Articles describe what the scores suggest. They do not make
          claims about availability, and they do not quote critics or reviews.
        </li>
        <li>
          <strong>Corrections.</strong> If you spot an error, write to{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and it will be fixed.
        </li>
      </ul>
      <p className={g.p}>
        Written and maintained by <a href="/about">{AUTHOR_NAME}</a>. Rating Watch is an independent
        project. It is not affiliated with or endorsed by Netflix, IMDb or Rotten Tomatoes; those names belong to
        their owners.
      </p>
    </>
  );
}

export default function Page() {
  if (!BLOG_HUB.ready) notFound();
  const data = getBlogData();
  // A ready registry without films.json is a stale registry: fail the build loudly.
  if (!data) throw new Error('blog hub: registry says ready but films.json is missing; run `npm run blog:registry`');

  const { films, stats, publishedSlugs, filmsFile } = data;
  const published = new Set(publishedSlugs);
  const sum = hubSummary(films, stats, publishedSlugs.length);
  const agreed = sum.archetypeCounts['agreed-high'] + sum.archetypeCounts['agreed-low'] + sum.archetypeCounts['agreed-mixed'];
  const excludedGroups = excludedByReason(excludedRows(filmsFile, displayTitle));
  const hasExcluded = excludedGroups.length > 0;
  const net = filmsFile.netflix;
  const dataFile = dataFileExists();
  const asOf = sum.oldestAsOf === sum.newestAsOf ? sum.oldestAsOf : `${sum.oldestAsOf} to ${sum.newestAsOf}`;

  const filmLink = (f: (typeof films)[number], text = articleLabel(f)) =>
    published.has(f.slug) ? <a href={`/blog/${f.slug}`}>{text}</a> : <span className={s.plain}>{text}</span>;

  return (
    <GuideLayout
      path={PATH}
      h1="The 100 most-watched Netflix films, rated by critics and audiences"
      lede={
        <>
          <strong>
            Across the {sum.total} most-watched Netflix films, IMDb and Rotten Tomatoes differ by a median of{' '}
            {sum.medianAbsGap} points.
          </strong>{' '}
          Critics scored higher on {sum.archetypeCounts['critics-higher']} films, audiences on{' '}
          {sum.archetypeCounts['audience-higher']}, and the scores agree within 9 points on {agreed}. Scores as of{' '}
          {asOf}, via OMDb.{' '}
          {sum.publishedCount >= sum.total
            ? `All ${sum.total} films have a full analysis.`
            : `A full analysis is published for ${sum.publishedCount} of ${sum.total} films so far; the rest are listed below with their scores.`}
        </>
      }
      bylineHref="/about"
        webPageOptions={{ type: 'CollectionPage' }}
      schema={[...(sum.publishedCount > 0 ? [itemListNode(data)] : []), ...(dataFile ? [datasetNode(data)] : [])]}
    >
      <div className={s.stats}>
        <div className={`${s.stat} ${s.statInk}`}>
          <span className={s.statValue}>{sum.medianAbsGap}</span>
          <span className={s.statLabel}>Median gap in points</span>
        </div>
        <div className={`${s.stat} ${s.statGold}`}>
          <span className={s.statValue}>{sum.archetypeCounts['critics-higher']}</span>
          <span className={s.statLabel}>Films where critics scored higher</span>
        </div>
        <div className={`${s.stat} ${s.statCard}`}>
          <span className={s.statValue}>{sum.archetypeCounts['audience-higher']}</span>
          <span className={s.statLabel}>Films where audiences scored higher</span>
        </div>
        <div className={`${s.stat} ${s.statPaper}`}>
          <span className={s.statValue}>{sum.publishedCount}</span>
          <span className={s.statLabel}>Full analyses published</span>
        </div>
      </div>

      <h2 className={g.h2} id="how-the-list-is-built">How is the list built?</h2>
      <p className={g.p}>{filmsFile.selectionRule}</p>
      <ul className={g.list}>
        <li>
          <strong>Popularity:</strong> Netflix&apos;s published{' '}
          <a href={NETFLIX_TOP10} {...external}>Top 10 data</a> ({formatAsOf(net.firstWeek)} to {formatAsOf(net.lastWeek)},
          downloaded {formatAsOf(net.downloadedAt)}). Films ranked in Netflix&apos;s Top 10 are listed by hours viewed;
          being in the list says nothing about what is on Netflix today.
        </li>
        <li>
          <strong>Scores:</strong> the IMDb rating and Rotten Tomatoes percentage for each film, from{' '}
          <a href={OMDB_URL} {...external}>OMDb</a>, fetched {asOf}. Gap = Rotten Tomatoes percentage minus the IMDb
          rating times ten, so a positive gap means critics scored higher. How the two scores are built is explained in{' '}
          <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes</a>.
        </li>
        <li>
          <strong>Method background:</strong> our earlier <a href="/research/imdb-vs-rotten-tomatoes-gap">44-film
          study of Netflix Originals</a> is a separate dated study with its own film list.
        </li>
      </ul>
      {dataFile && (
        <p>
          <a className={`ds-btn ${s.download}`} href={DATA_PATH} download>
            Download netflix-top-100.json
          </a>
        </p>
      )}

      <h2 className={g.h2} id="all-films">All {sum.total} films, most-watched first</h2>
      <div className={`${s.wrap} ${s.wrapTall}`} role="region" tabIndex={0} aria-label={`IMDb and Rotten Tomatoes scores for ${sum.total} Netflix films`}>
        <table className={`${s.table} ${s.master}`}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Film</th>
              <th scope="col">Year</th>
              <th scope="col"><span className={g.thImdb}>IMDb</span></th>
              <th scope="col"><span className={g.thRt}>RT</span></th>
              <th scope="col">Gap</th>
              <th scope="col">Metascore</th>
            </tr>
          </thead>
          <tbody dangerouslySetInnerHTML={{ __html: masterRowsHtml(films, stats, published) }} />
        </table>
      </div>
      <p className={`${g.p} ${s.small}`}>
        Gap in points: positive means Rotten Tomatoes is higher, negative means IMDb (times ten) is higher. Titles that
        are links have a full analysis; the others do not yet.
      </p>

      <h2 className={g.h2} id="where-critics-and-audiences-split">Where do critics and audiences split most?</h2>
      <div className={s.splitGrid}>
        {ARCHETYPE_ORDER.map((a) => {
          const top = topByArchetype(films, stats, a, 8);
          if (top.length === 0) return null;
          return (
            <div key={a} className={s.splitCard}>
              <h3>{ARCHETYPE_HEADING[a]} ({sum.archetypeCounts[a]})</h3>
              <ol>
                {top.map((f) => (
                  <li key={f.slug}>
                    {filmLink(f)} <span className={s.gapTag}>{formatSigned(stats[f.slug].gap)}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <h2 className={g.h2} id="by-genre">How do the scores split by genre?</h2>
      <div className={s.wrap} role="region" tabIndex={0} aria-label="Median gap by primary genre">
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Primary genre</th>
              <th scope="col" className={s.num}>Films</th>
              <th scope="col" className={s.num}>Median gap</th>
              <th scope="col">Widest gap</th>
            </tr>
          </thead>
          <tbody>
            {genreRows(films, stats).map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td className={s.num}>{r.count}</td>
                <td className={s.num}>{gapText(r.medianGap)}</td>
                <td>{r.largest ? <>{filmLink(r.largest)} <span className={s.gapTag}>{formatSigned(stats[r.largest.slug].gap)}</span></> : 'none'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`${g.p} ${s.small}`}>Genres with fewer than 5 films are grouped as Other. A film counts under its first-listed genre.</p>

      <h2 className={g.h2} id="by-release-period">How do the scores split by release period?</h2>
      <div className={s.wrap} role="region" tabIndex={0} aria-label="Median gap by release period">
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Release period</th>
              <th scope="col" className={s.num}>Films</th>
              <th scope="col" className={s.num}>Median gap</th>
            </tr>
          </thead>
          <tbody>
            {periodRows(films, stats).map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td className={s.num}>{r.count}</td>
                <td className={s.num}>{gapText(r.medianGap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasExcluded && (
        <>
          <h2 className={g.h2} id="popular-but-not-scored">Which popular films are not scored?</h2>
          <p className={g.p}>
            These titles ranked above the cut-off in Netflix&apos;s data but were skipped, and no score is estimated for
            them.
          </p>
          <ul className={g.list}>
            {excludedGroups.map((grp) => (
              <li key={grp.reason}>
                <strong>{grp.reason}:</strong> {grp.titles.join(', ')}.
              </li>
            ))}
          </ul>
        </>
      )}

      <HowArticlesAreMade />
    </GuideLayout>
  );
}
