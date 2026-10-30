// Cache-Control is intentionally not set here: Next emits its own for metadata
// routes (OG/Twitter images, robots, sitemap) and a config header would be sent
// as a second, conflicting Cache-Control line.
//
// /camera-vision uses getUserMedia, so camera must stay allowed for same-origin.
// No script-src/default-src CSP: that page loads tesseract.js workers/WASM and tfjs
// models from CDNs, and a script-src policy would break it without a verified
// allowlist. The only CSP directive set is frame-ancestors (below), which limits
// who may frame us and restricts nothing we load.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // stepto.net embeds the homepage as a live reference. frame-ancestors replaces
  // X-Frame-Options; no other site may frame us.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://stepto.net https://www.stepto.net" },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(self), microphone=(), geolocation=(), payment=(self "https://*.paddle.com"), usb=(), interest-cohort=()',
  },
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
    ]
  },
}

module.exports = nextConfig
