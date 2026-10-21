// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require('../next.config.js')

type Rule = { source: string; headers: { key: string; value: string }[] }

async function rules(): Promise<Rule[]> {
  return nextConfig.headers()
}

function headersFor(all: Rule[], source: string): Record<string, string> {
  return Object.fromEntries(
    all.filter((r) => r.source === source).flatMap((r) => r.headers.map((h) => [h.key, h.value])),
  )
}

describe('next.config.js', () => {
  it('hardens the server defaults', () => {
    expect(nextConfig.poweredByHeader).toBe(false)
    expect(nextConfig.compress).toBe(true)
    expect(nextConfig.reactStrictMode).toBe(true)
  })

  it('disables the image optimizer (open advisories on Next 14.2; no next/image in use)', () => {
    expect(nextConfig.images).toEqual({ unoptimized: true })
  })

  it('applies security headers to every route', async () => {
    const h = headersFor(await rules(), '/:path*')
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN')
    expect(h['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains')
  })

  it('keeps camera allowed for /camera-vision but disables other sensitive features', async () => {
    const policy = headersFor(await rules(), '/:path*')['Permissions-Policy']
    expect(policy).toContain('camera=(self)')
    for (const f of ['microphone', 'geolocation']) {
      expect(policy).toContain(`${f}=()`)
    }
    // Paddle's checkout iframe needs wallet payments (Apple Pay, Google Pay).
    expect(policy).toContain('payment=(self "https://*.paddle.com")')
  })

  it('does not set a CSP or cross-origin isolation (would break tfjs/tesseract CDN loads)', async () => {
    const keys = (await rules()).flatMap((r) => r.headers.map((h) => h.key.toLowerCase()))
    expect(keys).not.toContain('content-security-policy')
    expect(keys).not.toContain('cross-origin-embedder-policy')
    expect(keys).not.toContain('cross-origin-opener-policy')
  })

  it('leaves Cache-Control to Next (a config header would duplicate its own)', async () => {
    const keys = (await rules()).flatMap((r) => r.headers.map((h) => h.key.toLowerCase()))
    expect(keys).not.toContain('cache-control')
  })
})
