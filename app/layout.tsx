import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Archivo, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { SITE_URL } from '../lib/content';
import { HOME_TITLE, HOME_DESCRIPTION } from '../lib/pages';
import { TITLE_SUFFIX, jsonLdString, siteGraph } from '../lib/seo';
import ConsentBanner from '../components/ConsentBanner';

// Variable Archivo with the width axis: `font-stretch: 62%` + weight 900 gives the
// condensed display face; normal width (100%) is the body text.
const archivo = Archivo({
  subsets: ['latin'],
  weight: 'variable',
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
  // The generated fallback is plain Arial, which has no width axis: 62%-wide display type would
  // re-wrap on swap (CLS). Skip it so the stack in globals.css falls through to Arial Narrow.
  adjustFontFallback: false,
});

const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-serif-src',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-mono-src',
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
  applicationName: 'Rating Watch',
  keywords: [
    'Rating Watch',
    'Netflix IMDb',
    'Netflix Rotten Tomatoes',
    'Netflix ratings extension',
    'IMDb Chrome extension',
    'Netflix score overlay',
    'what to watch on Netflix',
    'Netflix browser extension',
  ],
  authors: [{ name: 'Igor Gazivoda', url: `${SITE_URL}/about` }],
  creator: 'Igor Gazivoda',
  category: 'technology',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Rating Watch',
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
      { url: '/icon', type: 'image/png', sizes: '512x512' },
    ],
    // iOS ignores SVG touch icons; /apple-icon is the generated 180px PNG.
    apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#ece6d8',
  colorScheme: 'light',
};

// Structured data — helps both Google rich results and AI search engines
// (ChatGPT, Perplexity, Google AI Overviews) understand and cite the page.
const jsonLd = siteGraph();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
        />
      </head>
      <body>
        {/* The skip link is the very first tab stop, before the cookie banner, so keyboard users can skip both. */}
        <a className="skip-link" href="#main">Skip to main content</a>
        {/* Early in the body so assistive tech reaches it. Google Analytics loads only after Accept. */}
        <ConsentBanner />
        {children}
      </body>
    </html>
  );
}
