'use client'
import { OPEN_CONSENT_EVENT } from '../lib/consent'
import { CONSENT_BANNER_ENABLED } from '../lib/analytics'
import c from './CookieSettings.module.css'

// Footer link that reopens the consent banner so the choice can be changed at any time.
export default function CookieSettings() {
  if (!CONSENT_BANNER_ENABLED) return null
  return (
    <button type="button" className={c.link} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      Cookie settings
    </button>
  )
}
