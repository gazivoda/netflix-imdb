// Google Analytics 4 measurement id for the website (not the extension). Public by design.
// NEXT_PUBLIC_GA_ID overrides it per environment; the literal read lets Next inline it at build time.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-S5744YW7M7'

// Only production traffic is measured, so local development and test builds never pollute the data.
export const ANALYTICS_ENABLED = process.env.NODE_ENV === 'production' && GA_MEASUREMENT_ID.length > 0

// Google's standard gtag.js init snippet. It is not inlined in the page any more: lib/analytics-client.ts
// runs the same steps, and only after consent.
export const GTAG_INIT = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`

// The banner is shown wherever there is an id, so it can be tested in development. Loading the tag
// still requires ANALYTICS_ENABLED (production), and nothing loads before the visitor accepts.
export const CONSENT_BANNER_ENABLED = GA_MEASUREMENT_ID.length > 0
