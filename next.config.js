// Cache-Control is intentionally not set site-wide: Next emits its own for metadata
// routes (OG/Twitter images, robots, sitemap) and a config header would be sent
// as a second, conflicting Cache-Control line. The one exception is the static
// research datasets under /data/ (see dataHeaders), which are plain files from public/.
//
// /camera-vision uses getUserMedia, so camera must stay allowed for same-origin.
// No script-src/default-src CSP: that page loads tesseract.js workers/WASM and tfjs
// models from CDNs, and a script-src policy would break it without a verified
// allowlist. The only CSP directive set is frame-ancestors (below), which limits
// who may frame us and restricts nothing we load.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // stepto.net embeds the homepage as a live reference (localhost so the embed
  // also works while developing that site). frame-ancestors replaces
  // X-Frame-Options; no other site may frame us.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://stepto.net https://www.stepto.net http://localhost:*" },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(self), microphone=(), geolocation=(), payment=(self "https://*.paddle.com"), usb=(), interest-cohort=()',
  },
]

const dataHeaders = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ['better-sqlite3'] },
  // Next 14.2 has open advisories in the image optimizer (/_next/image). The site only serves static assets
  // and never uses next/image, so the optimizer endpoint is switched off. Remove after the Next upgrade.
  images: { unoptimized: true },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Public research datasets: readable from any origin (notebooks, browser-based tools) and
      // cacheable for a day, with a week of stale-while-revalidate. Only static files under
      // public/data/ match, so Next's own metadata routes keep their own Cache-Control.
      { source: '/data/:file*.json', headers: dataHeaders },
      { source: '/data/:file*.csv', headers: dataHeaders },
    ]
  },
}

module.exports = nextConfig
