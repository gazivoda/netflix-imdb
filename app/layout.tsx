import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Hanken_Grotesk } from 'next/font/google';
import { SITE_URL, REPO_URL } from '../lib/content';
import { HOME_TITLE, HOME_DESCRIPTION } from '../lib/pages';
import { TITLE_SUFFIX, jsonLdString, siteGraph } from '../lib/seo';

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

const TITLE = HOME_TITLE;
const DESCRIPTION = HOME_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s${TITLE_SUFFIX}`,
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
const jsonLd = siteGraph();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
