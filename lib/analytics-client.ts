// Browser-only Google Analytics control. Nothing here runs until the visitor accepts (see ConsentBanner).
import { ANALYTICS_ENABLED, GA_MEASUREMENT_ID } from './analytics'

const SCRIPT_ID = 'rw-gtag-js'
const SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
const DISABLE_KEY = `ga-disable-${GA_MEASUREMENT_ID}`

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } & Record<string, unknown>
const w = (): GtagWindow => window as unknown as GtagWindow

/** Hostname plus every parent domain with at least two labels: www.rating.watch -> www.rating.watch, rating.watch. */
export function cookieDomains(hostname: string): string[] {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (!host || /^[\d.]+$/.test(host) || host.includes(':')) return host ? [host] : [] // IPs: no parents
  const labels = host.split('.')
  if (labels.length < 2) return [host]
  return labels.slice(0, -1).map((_, i) => labels.slice(i).join('.'))
}

/** The Google Analytics cookie names for a measurement id: _ga and _ga_<id without "G-">. */
export function gaCookieNames(measurementId: string): string[] {
  return ['_ga', `_ga_${measurementId.replace(/^G-/, '')}`]
}

/** document.cookie strings that expire the GA cookies on the host-only scope and on every domain variant. */
export function expiryCookieStrings(hostname: string, measurementId: string): string[] {
  const past = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/'
  const out: string[] = []
  for (const name of gaCookieNames(measurementId)) {
    out.push(`${name}=; ${past}`)
    for (const d of cookieDomains(hostname)) {
      out.push(`${name}=; ${past}; domain=${d}`)
      out.push(`${name}=; ${past}; domain=.${d}`)
    }
  }
  return out
}

/** Inject gtag.js and run Google's init. Safe to call any number of times; a no-op outside production. */
export function loadAnalytics(): boolean {
  if (!ANALYTICS_ENABLED || typeof window === 'undefined') return false
  const win = w()
  win[DISABLE_KEY] = false // accepting again after a withdrawal re-enables measurement
  if (document.getElementById(SCRIPT_ID)) return true
  win.dataLayer = win.dataLayer || []
  // gtag.js expects the arguments object itself on the dataLayer, not an array.
  win.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    win.dataLayer!.push(arguments)
  }
  win.gtag('js', new Date())
  win.gtag('config', GA_MEASUREMENT_ID)
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.async = true
  script.src = SCRIPT_SRC
  document.head.appendChild(script)
  return true
}

/** Stop measurement and delete the Google cookies. Safe to call repeatedly, and when analytics never loaded. */
export function revokeAnalytics(): void {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) return
  try {
    w()[DISABLE_KEY] = true
    for (const c of expiryCookieStrings(window.location.hostname, GA_MEASUREMENT_ID)) document.cookie = c
  } catch {
    // Cookie access can be blocked; the disable flag above is what stops further collection.
  }
}
