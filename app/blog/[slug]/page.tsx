import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import GuideLayout, { type Faq } from '../../../components/GuideLayout';
import g from '../../../components/guide.module.css';
import s from '../blog.module.css';
import { Prose } from '../_components/Prose';
import { getBlogData } from '../_lib/data';
import { countRenderedWords, plainText, splitFirstSentence } from '../_lib/prose';
import {
  citedSources,
  dataSources,
  factRows,
  relatedItems,
  renderArticle,
  scoreRows,
  scoresAsOfLine,
} from '../_lib/article-view';
import { getPage } from '../../../lib/pages';
import { articleLabel } from '../../../lib/blog/title';
import { blogPosting, movie, nodeId, pageMetadata } from '../../../lib/seo';

// Only published articles exist: unknown slugs are a 404, nothing renders on demand.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return (getBlogData()?.publishedSlugs ?? []).map((slug) => ({ slug }));
}

const pathOf = (slug: string) => `/blog/${slug}`;

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  // The opengraph-image / twitter-image files in this segment supply the share images.
  return pageMetadata(pathOf(params.slug), { fileImages: true });
}

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

export default function Page({ params }: { params: { slug: string } }) {
  const data = getBlogData();
  const article = data?.published.get(params.slug);
  const film = data?.films.find((f) => f.slug === params.slug);
  if (!data || !article || !film) notFound();

  const path = pathOf(film.slug);
  const stats = data.stats[film.slug];
  const page = getPage(path);
  const view = renderArticle(article, film, stats);

  const [lead, rest] = splitFirstSentence(view.summary);
  const faqs: Faq[] = view.faq.map((f) => ({ q: f.q, a: plainText(f.a), aNode: <Prose text={f.a} /> }));
  const published = new Set(data.publishedSlugs);
  const facts = factRows(film, stats, { films: data.films, stats: data.stats, published });
  const rows = scoreRows(film, stats);
  const cited = citedSources(article);
  const sources = dataSources(film, article, data.filmsFile);
  const related = relatedItems(article, film, { films: data.films, stats: data.stats, published: data.publishedSlugs });
  const names = new Map(data.films.map((f) => [f.slug, f]));

  const wordCount = countRenderedWords(
    view.summary,
    ...view.sections.flatMap((x) => x.paragraphs),
    ...(view.dataNote ? view.dataNote.paragraphs : []),
    ...view.faq.map((f) => f.a),
  );

  const asOf = scoresAsOfLine(film, data.filmsFile);

  return (
    <GuideLayout
      path={path}
      h1={view.h1}
      lede={
        <>
          <strong><Prose text={lead} /></strong>
          {rest ? <>{' '}<Prose text={rest} /></> : null}
        </>
      }
      crumbs={[{ name: 'Blog', path: '/blog' }]}
      bylineHref="/about"
      showPublished
      meta={asOf}
      webPageOptions={{ about: { '@id': nodeId(path, 'film') } }}
      articleNode={blogPosting(path, {
        headline: view.h1,
        description: page.description,
        published: page.published ?? article.published ?? page.updated,
        updated: page.updated,
        wordCount,
      })}
      schema={[movie(film, path)]}
      faqs={faqs}
      faqSchema={false}
      after={
        <>
          {cited.length > 0 && (
            <>
              <h2 className={g.h2} id="sources">Sources</h2>
              <ol className={s.sourceList}>
                {cited.map((src, i) => (
                  <li key={src.id} id={`source-${i + 1}`}>
                    <a href={src.url} {...external}>{src.title}</a>
                    <span className={s.hint}>, {src.publisher}, accessed {src.accessed}. Supports: {src.supports}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          <h2 className={g.h2} id="data-sources">Where the numbers come from</h2>
          <ul className={s.plainList}>
            {sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} {...external}>{src.title}</a>
                <span className={s.hint}>, {src.publisher}{src.detail ? `: ${src.detail}` : ''}</span>
              </li>
            ))}
          </ul>
          <p className={s.methodLine}>
            {asOf} Scores come from OMDb, which relays IMDb and Rotten Tomatoes. Rating Watch is
            independent and is not affiliated with or endorsed by Netflix, IMDb or Rotten Tomatoes.
            The text of this article is AI-assisted and fact-checked against the cited data. See{' '}
            <a href="/blog#how-articles-are-made">how these articles are made</a>.
          </p>

          <h2 className={g.h2} id="more-films">More films and background</h2>
          <ul className={s.relatedList}>
            {related.map((r) => {
              const f = names.get(r.slug);
              return (
                <li key={r.slug}>
                  <a href={pathOf(r.slug)}>{f ? articleLabel(f) : r.label}</a>
                  {r.hint ? <span className={s.hint}>: {r.hint}</span> : null}
                </li>
              );
            })}
            <li>
              <a href="/blog">All {stats.setSize} films and their scores</a>
              <span className={s.hint}>: the full table, split by genre and period</span>
            </li>
            <li>
              <a href="/compare/imdb-vs-rotten-tomatoes">IMDb vs Rotten Tomatoes</a>
              <span className={s.hint}>: how the two scores are built</span>
            </li>
            <li>
              <a href="/research/imdb-vs-rotten-tomatoes-gap">Our 44-film study of Netflix Originals</a>
              <span className={s.hint}>: a separate dated study with its own method</span>
            </li>
          </ul>
        </>
      }
    >
      <div className={s.wrap} role="region" tabIndex={0} aria-label={`Scores for ${view.h1}`}>
        <table className={s.table}>
          <caption>Scores</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Value</th>
              <th scope="col">What it is</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">
                  {r.kind ? <span className={r.kind === 'imdb' ? g.thImdb : g.thRt}>{r.label}</span> : r.label}
                </th>
                <td className={s.value}>{r.value}</td>
                <td className={s.note}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.dataNote && (
        <div className={s.dataNote}>
          <h2 className={s.subhead}>{view.dataNote.heading}</h2>
          {view.dataNote.paragraphs.map((p, i) => (
            <p key={i} className={g.p}><Prose text={p} /></p>
          ))}
        </div>
      )}

      <div className={s.cta}>
        <p>See both scores on every Netflix card while you browse.</p>
        <a className={g.btnPrimary} href="/install">Install Rating Watch</a>
      </div>

      <h2 className={s.subhead}>Where it sits</h2>
      <dl className={s.facts}>
        {facts.map((f) => (
          <div key={f.term}>
            <dt>{f.term}</dt>
            <dd>
              {f.parts.map((p, i) => (p.href ? <a key={i} href={p.href}>{p.text}</a> : <span key={i}>{p.text}</span>))}
            </dd>
          </div>
        ))}
      </dl>

      {view.sections.map((sec) => (
        <section key={sec.id} aria-labelledby={`sec-${sec.id}`}>
          <h2 className={g.h2} id={`sec-${sec.id}`}>{sec.heading}</h2>
          {sec.paragraphs.map((p, i) => (
            <p key={i} className={g.p}><Prose text={p} /></p>
          ))}
        </section>
      ))}
    </GuideLayout>
  );
}
