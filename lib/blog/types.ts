// Shared types for the Top 100 blog (spec 2.3 films.json, spec 3.1 article files).
// Types only: no runtime code, safe to import from anywhere.

export interface FilmsFile {
  schemaVersion: 1;
  name: string;
  description: string;
  /** "Scores belong to IMDb and Rotten Tomatoes via OMDb; popularity data from Netflix" */
  license: string;
  /** The R1+R2 rule in one paragraph, rendered on /blog. */
  selectionRule: string;
  listSource: 'netflix-download' | 'committed-snapshot';
  netflix: {
    weeklyUrl: string;
    mostPopularUrl: string;
    downloadedAt: string;
    firstWeek: string;
    lastWeek: string;
    weeklySha256: string;
    mostPopularSha256: string;
  };
  /** ISO datetime. */
  generatedAt: string;
  counts: {
    filmTitles: number;
    tvTitlesSkipped: number;
    poolEvaluated: number;
    eligible: 100;
    excluded: number;
  };
  /** Exactly 100, ordered by popularityRank. */
  films: Film[];
  excluded: { netflixTitle: string; poolRank: number; reason: string; imdbId?: string }[];
}

export interface Film {
  /** See spec 4.2. */
  slug: string;
  /** 1..100 among eligible. */
  popularityRank: number;
  poolRank: number;
  netflix: {
    title: string;
    category: 'Films (English)' | 'Films (Non-English)';
    popularityHours: number;
    hoursSource: 'weekly-sum' | 'first-91-days';
    weeksInTop10: number;
    peakRank: number | null;
    firstWeek: string | null;
    lastWeek: string | null;
    mostPopularRank: number | null;
    /** Null when Netflix publishes no runtime for the title (the runtime cross-check is then skipped). */
    runtimeMin: number | null;
  };
  omdb: {
    imdbId: string;
    title: string;
    year: number;
    rated: string | null;
    /** ISO date. */
    released: string | null;
    runtimeMin: number;
    genres: string[];
    directors: string[];
    writers: string[];
    actors: string[];
    plot: string | null;
    languages: string[];
    countries: string[];
    awards: string | null;
    metascore: number | null;
    imdbRating: number;
    imdbVotes: number;
    rtPercent: number;
  };
  /** ISO datetime of THIS film's OMDb response. */
  fetchedAt: string;
  /** ISO date; changes only when a displayed value changes on refresh. */
  dataChangedAt: string;
}

// ---------------------------------------------------------------- articles (spec 3.1)

export type Status = 'draft' | 'review' | 'checked' | 'published';

export interface ArticleSection {
  /** why-split, the-film, who-it-suits (required); more, data-note (optional). */
  id: string;
  heading: string;
  paragraphs: string[];
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface SourceRef {
  id: string;
  /** https only. */
  url: string;
  title: string;
  publisher: string;
  /** YYYY-MM-DD */
  accessed: string;
  /** The exact claim this source backs, <= 200 chars. */
  supports: string;
}

export interface ReviewBlock {
  writer: string;
  writtenOn: string;
  factChecker: string | null;
  factCheckedOn: string | null;
  cuts: string[];
  rtCheck: null | {
    checkedOn: string;
    url: string;
    rtSitePercent: number;
    rtSiteReviews: number;
    outcome: 'match' | 'note' | 'hold';
  };
}

export interface Article {
  schemaVersion: 1;
  /** Equals the filename and a films.json slug. */
  slug: string;
  /** Equals the film's omdb.imdbId. */
  imdbId: string;
  status: Status;
  /** YYYY-MM-DD, set only when status is "published". */
  published: string | null;
  /** YYYY-MM-DD, last real prose edit. */
  contentUpdated: string;
  /** <= 29 chars, only when the title chain cannot fit. */
  shortTitle?: string;
  h1: string;
  description: string;
  summary: string;
  sections: ArticleSection[];
  faq: FaqItem[];
  sources: SourceRef[];
  related?: { slug: string; reason: string }[];
  review: ReviewBlock;
}
