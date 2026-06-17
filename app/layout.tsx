import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Hanken_Grotesk } from 'next/font/google';
import { SITE_URL, REPO_URL, FAQS, AUTHOR_NAME, PUBLISHED_DATE, LAST_UPDATED } from '../lib/content';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const body = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

const TITLE = 'Netflix Ratings — IMDb & Rotten Tomatoes scores on every Netflix card';
const DESCRIPTION =
  'A free, open-source Chrome extension that shows IMDb and Rotten Tomatoes ratings directly on Netflix title cards as you browse. No account, no tab-switching — just scroll and decide.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · Netflix Ratings',
  },
  description: DESCRIPTION,
  applicationName: 'Netflix Ratings',
  keywords: [
    'Netflix IMDb',
    'Netflix Rotten Tomatoes',
    'Netflix ratings extension',
    'IMDb Chrome extension',
    'Netflix score overlay',
    'what to watch on Netflix',
    'Netflix browser extension',
  ],
  authors: [{ name: 'Igor Gazivoda', url: REPO_URL }],
  creator: 'Igor Gazivoda',
  alternates: { canonical: '/' },
  category: 'technology',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Netflix Ratings',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0a0b',
  colorScheme: 'dark',
};

// Structured data — helps both Google rich results and AI search engines
// (ChatGPT, Perplexity, Google AI Overviews) understand and cite the page.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#author`,
      name: AUTHOR_NAME,
      url: REPO_URL,
      sameAs: [REPO_URL],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Netflix Ratings',
      description: DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#org` },
      inLanguage: 'en',
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: 'Netflix Ratings',
      url: SITE_URL,
      description:
        'Maker of Netflix Ratings, a free open-source browser extension that adds IMDb and Rotten Tomatoes scores to Netflix.',
      founder: { '@id': `${SITE_URL}/#author` },
      sameAs: [REPO_URL],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#app`,
      name: 'Netflix Ratings',
      applicationCategory: 'BrowserApplication',
      operatingSystem: 'Chrome, Chromium, Edge, Brave',
      description: DESCRIPTION,
      url: SITE_URL,
      downloadUrl: REPO_URL,
      softwareVersion: '1.0.0',
      datePublished: PUBLISHED_DATE,
      dateModified: LAST_UPDATED,
      isAccessibleForFree: true,
      author: { '@id': `${SITE_URL}/#author` },
      publisher: { '@id': `${SITE_URL}/#org` },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'IMDb ratings on every Netflix title card',
        'Rotten Tomatoes critic scores',
        'Parallel loading of all visible cards',
        'No account or login required',
        'Privacy-friendly, no tracking',
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
