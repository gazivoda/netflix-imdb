'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CONSENT_BANNER_ENABLED } from '../lib/analytics'
import { loadAnalytics, revokeAnalytics } from '../lib/analytics-client'
import { OPEN_CONSENT_EVENT, browserStorage, readConsent, shouldPrompt, writeConsent } from '../lib/consent'
import { reserveBottomSpace } from './consent-space'
import c from './ConsentBanner.module.css'

// Decided after mount so the prerendered HTML is identical for everyone (renders nothing) and nothing shifts.
// Nothing Google-related exists on the page until the visitor presses Accept, or had accepted on a past visit.
export default function ConsentBanner() {
  const [open, setOpen] = useState(false)
  const region = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const stored = readConsent(browserStorage())
    if (stored === 'granted') loadAnalytics()
    else if (shouldPrompt(stored)) setOpen(true)

    const reopen = () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setOpen(true)
    }
    window.addEventListener(OPEN_CONSENT_EVENT, reopen)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen)
  }, [])

  // A reopened banner takes focus so keyboard and screen reader users land on it; it is not a trap.
  useEffect(() => {
    if (open && opener.current) region.current?.focus({ preventScroll: true })
  }, [open])

  // While the banner is visible, keep the page's last rows scrollable above it; the space is removed when it hides.
  useEffect(() => {
    const el = region.current
    if (!open || !el) return
    return reserveBottomSpace(document.documentElement, el, typeof ResizeObserver === 'undefined' ? undefined : ResizeObserver)
  }, [open])

  const decide = useCallback((value: 'granted' | 'denied') => {
    writeConsent(browserStorage(), value)
    if (value === 'granted') loadAnalytics()
    else revokeAnalytics()
    setOpen(false)
    const back = opener.current
    opener.current = null
    if (back && back.isConnected) back.focus()
  }, [])

  if (!CONSENT_BANNER_ENABLED || !open) return null

  return (
    <div ref={region} className={c.banner} role="region" aria-label="Cookie consent" tabIndex={-1}>
      <div className={c.inner}>
        <p className={c.text}>
          We use Google Analytics to count visits. It sets cookies only if you accept. Nothing is sent to Google
          before that. <a href="/privacy#website-analytics">How we use it</a>
        </p>
        <div className={c.actions}>
          <button type="button" className={c.btn} onClick={() => decide('granted')}>Accept analytics</button>
          <button type="button" className={c.btn} onClick={() => decide('denied')}>Decline</button>
        </div>
      </div>
    </div>
  )
}
