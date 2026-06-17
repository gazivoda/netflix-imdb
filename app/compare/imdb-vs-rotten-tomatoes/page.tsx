import type { Metadata } from 'next';
import styles from './compare.module.css';
import { SITE_URL, REPO_URL, AUTHOR_NAME, PUBLISHED_DATE, LAST_UPDATED, LAST_UPDATED_LABEL } from '../../../lib/content';

const TITLE = 'IMDb vs Rotten Tomatoes: What the Difference Means for What You Watch';
const DESCRIPTION =
  'IMDb is an audience score out of 10; Rotten Tomatoes is the percentage of critics who liked a film. Here is how the two rating systems differ, why they disagree, and when to trust each one.';
const PATH = '/compare/imdb-vs-rotten-tomatoes';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: 'article',
    url: `${SITE_URL}${PATH}`,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const ROWS = [
  {
    aspect: 'What it measures',
    imdb: 'The average rating from registered users, on a 1–10 scale.',
    rt: 'The percentage of approved critics whose review was positive (the Tomatometer).',
  },
  {
    aspect: 'Who votes',
    imdb: 'The general public — anyone with an IMDb account.',
    rt: 'Professional film and TV critics (plus a separate Audience Score).',
  },
  {
    aspect: 'Scale',
    imdb: '0.0 to 10.0, weighted to limit vote brigading.',
    rt: '0% to 100%, a pass/fail tally — not an average of how good reviews were.',
  },
  {
    aspect: 'What a high score means',
    imdb: 'Lots of people enjoyed it.',
    rt: 'Most critics thought it was at least good — not necessarily great.',
  },
  {
    aspect: 'Best at spotting',
    imdb: 'Crowd-pleasers, cult favorites, and long-tail fan loyalty.',
    rt: 'Critical consensus and craft, especially for new releases.',
  },
  {
    aspect: 'Blind spot',
    imdb: 'Fan brigading and nostalgia can inflate scores.',
    rt: 'A 90% can hide films critics found merely "fine," not excellent.',
  },
];

const FAQS = [
  {
    q: 'What is the difference between IMDb and Rotten Tomatoes?',
    a: 'IMDb shows an average user rating on a 1–10 scale, reflecting what the general public thinks. Rotten Tomatoes shows the Tomatometer — the percentage of professional critics who gave a positive review. IMDb measures how much people liked something; Rotten Tomatoes measures how many critics approved of it.',
  },
  {
    q: 'Is a high Rotten Tomatoes score the same as a high IMDb score?',
    a: 'No. A 90% Tomatometer means 90% of critics gave a positive review, but it does not say how positive. A film can score 95% on Rotten Tomatoes yet only 7.0 on IMDb if critics liked it but audiences found it forgettable. The two numbers answer different questions, which is why seeing both is more useful than either alone.',
  },
  {
    q: 'Which rating is more reliable, IMDb or Rotten Tomatoes?',
    a: 'Neither is universally better. Rotten Tomatoes is a strong guide to critical quality and craft, especially for new releases. IMDb is a better signal of broad, lasting audience enjoyment and is harder to manipulate for older titles. For the most reliable read, compare both: agreement is a strong signal, and disagreement tells you whether a title leans crowd-pleaser or critics-darling.',
  },
  {
    q: 'Why do IMDb and Rotten Tomatoes scores disagree?',
    a: 'They disagree because they measure different things and poll different people. Critics reward originality, direction, and writing; general audiences reward entertainment and emotional payoff. Big gaps often appear with crowd-pleasing blockbusters (high IMDb, lower Rotten Tomatoes) and arthouse or critically acclaimed films (high Rotten Tomatoes, lower IMDb).',
  },
  {
    q: 'Can I see both scores while browsing Netflix?',
    a: 'Yes. The free Netflix Ratings Chrome extension overlays both the IMDb rating and the Rotten Tomatoes score directly on every Netflix title card, so you can compare the audience and critic view without leaving Netflix or opening another tab.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'IMDb vs Rotten Tomatoes', item: `${SITE_URL}${PATH}` },
      ],
    },
    {
      '@type': 'Article',
      headline: TITLE,
      description: DESCRIPTION,
      mainEntityOfPage: `${SITE_URL}${PATH}`,
      datePublished: PUBLISHED_DATE,
      dateModified: LAST_UPDATED,
      author: { '@type': 'Person', name: AUTHOR_NAME, url: REPO_URL },
      publisher: { '@type': 'Organization', name: 'Netflix Ratings', url: SITE_URL },
      inLanguage: 'en',
      about: ['IMDb', 'Rotten Tomatoes', 'movie ratings', 'Netflix'],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

export default function ComparePage() {
  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className={styles.nav}>
        <a className={styles.navLogo} href="/">
          <span className={styles.navLogoIcon} aria-hidden>★</span>
          Netflix Ratings
        </a>
        <a href={REPO_URL} className={styles.navInstall} target="_blank" rel="noopener noreferrer">
          Get the extension
        </a>
      </nav>

      <article className={styles.article}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <a href="/">Home</a> <span aria-hidden>/</span> IMDb vs Rotten Tomatoes
        </nav>

        <header className={styles.head}>
          <h1 className={styles.h1}>IMDb vs Rotten Tomatoes</h1>
          <p className={styles.byline}>
            By{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">{AUTHOR_NAME}</a>
            {' · Updated '}
            <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
          </p>
          <p className={styles.lede}>
            Two of the most-quoted ratings in film disagree all the time — because they measure
            different things. <strong>IMDb is an average audience score out of 10. Rotten Tomatoes
            is the percentage of critics who liked a film.</strong> Here&apos;s how to read each one,
            and why seeing both on the same Netflix card beats trusting either alone.
          </p>
        </header>

        {/* score visual */}
        <div className={styles.versus}>
          <div className={`${styles.vsCard} ${styles.vsImdb}`}>
            <span className={styles.vsTag}>★ IMDb</span>
            <span className={styles.vsScore}>8.7<span className={styles.vsUnit}>/10</span></span>
            <span className={styles.vsWho}>What audiences rated it</span>
          </div>
          <span className={styles.vsDivider} aria-hidden>vs</span>
          <div className={`${styles.vsCard} ${styles.vsRt}`}>
            <span className={styles.vsTag}>🍅 Rotten Tomatoes</span>
            <span className={styles.vsScore}>86<span className={styles.vsUnit}>%</span></span>
            <span className={styles.vsWho}>Share of critics who approved</span>
          </div>
        </div>

        <h2 className={styles.h2}>How the two systems differ</h2>
        <p className={styles.p}>
          The single most important thing to know: a Rotten Tomatoes percentage is a head-count, not
          a quality average. A 100% score means every counted critic gave a thumbs-up — it does{' '}
          <em>not</em> mean the film is a masterpiece. IMDb, by contrast, averages how highly people
          actually rated it. That difference explains nearly every disagreement between the two.
        </p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">&nbsp;</th>
                <th scope="col"><span className={styles.thImdb}>★ IMDb</span></th>
                <th scope="col"><span className={styles.thRt}>🍅 Rotten Tomatoes</span></th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.aspect}>
                  <th scope="row">{r.aspect}</th>
                  <td>{r.imdb}</td>
                  <td>{r.rt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className={styles.h2}>When to trust each one</h2>
        <div className={styles.whenGrid}>
          <div className={styles.whenCard}>
            <h3 className={styles.whenTitle}><span aria-hidden>★</span> Lean on IMDb when…</h3>
            <ul className={styles.list}>
              <li>You want to know if regular viewers actually enjoyed it.</li>
              <li>The title is older — fan ratings have settled over years.</li>
              <li>You&apos;re choosing a comfort rewatch or a crowd-pleaser.</li>
            </ul>
          </div>
          <div className={styles.whenCard}>
            <h3 className={styles.whenTitle}><span aria-hidden>🍅</span> Lean on Rotten Tomatoes when…</h3>
            <ul className={styles.list}>
              <li>It&apos;s a new release and you want the critical read.</li>
              <li>You care about craft — direction, writing, performances.</li>
              <li>You want to avoid a film critics broadly panned.</li>
            </ul>
          </div>
        </div>

        <h2 className={styles.h2}>The real trick: read them together</h2>
        <p className={styles.p}>
          Each score on its own is a partial picture. Together they tell a story. When IMDb and
          Rotten Tomatoes <strong>agree and both are high</strong>, that&apos;s a safe bet. When they
          <strong> split</strong>, the direction tells you what kind of film it is:
        </p>
        <ul className={styles.list}>
          <li><strong>High IMDb, lower RT</strong> — a crowd-pleaser critics were cool on. Great for a fun night in.</li>
          <li><strong>High RT, lower IMDb</strong> — a critics&apos; darling that didn&apos;t land with everyone. Worth it if you&apos;re in the mood for something ambitious.</li>
          <li><strong>Both low</strong> — usually safe to skip.</li>
        </ul>

        <aside className={styles.callout}>
          <h2 className={styles.calloutTitle}>See both scores on every Netflix card</h2>
          <p>
            Instead of checking two sites, the free <strong>Netflix Ratings</strong> extension puts
            the IMDb rating and the Rotten Tomatoes score right on each Netflix title card as you
            browse. Compare audience and critics at a glance — then press play.
          </p>
          <a href={REPO_URL} className={styles.btnPrimary} target="_blank" rel="noopener noreferrer">
            Install free <span aria-hidden>→</span>
          </a>
        </aside>

        <h2 className={styles.h2} id="faq">Frequently asked questions</h2>
        <div className={styles.faqList}>
          {FAQS.map((f, i) => (
            <details key={f.q} className={styles.faqItem} open={i === 0}>
              <summary className={styles.faqQ}>
                {f.q}
                <span className={styles.faqChevron} aria-hidden>+</span>
              </summary>
              <p className={styles.faqA}>{f.a}</p>
            </details>
          ))}
        </div>
      </article>

      <footer className={styles.footer}>
        <a href="/">← Back to Netflix Ratings</a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
    </div>
  );
}
