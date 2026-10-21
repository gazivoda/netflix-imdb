'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CONSENT_BANNER_ENABLED } from '../lib/analytics'
import { loadAnalytics, revokeAnalytics } from '../lib/analytics-client'
import { OPEN_CONSENT_EVENT, browserStorage, readConsent, shouldPrompt, writeConsent } from '../lib/consent'
import { escapeDismissesBanner, focusTargetAfterBanner } from './consent-focus'
import { reserveBottomSpace } from './consent-space'
import c from './ConsentBanner.module.css'

// Decided after mount so the prerendered HTML is identical for everyone (renders nothing) and nothing shifts.
// Nothing Google-related exists on the page until the visitor presses Accept, or had accepted on a past visit.
export default function ConsentBanner() {
  const [open, setOpen] = useState(false)
  // True when the visitor reopened the banner from the footer to review an earlier choice (the first-visit banner is not).
  const [reopened, setReopened] = useState(false)
  const region = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const stored = readConsent(browserStorage())
    if (stored === 'granted') loadAnalytics()
    else if (shouldPrompt(stored)) setOpen(true)

    const reopen = () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setReopened(true)
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

  // Hides the banner and puts focus somewhere sensible (never on <body>) once the focused button is gone.
  const close = useCallback(() => {
    setOpen(false)
    setReopened(false)
    const back = opener.current
    opener.current = null
    // After the re-render has removed the banner, so the target is not behind it.
    setTimeout(() => focusTargetAfterBanner(back, document)?.focus({ preventScroll: true }), 0)
  }, [])

  const decide = useCallback((value: 'granted' | 'denied') => {
    writeConsent(browserStorage(), value)
    if (value === 'granted') loadAnalytics()
    else revokeAnalytics()
    close()
  }, [close])

  // Escape dismisses only the reopened banner; the existing choice stays as it was.
  useEffect(() => {
    if (!open || !reopened) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escapeDismissesBanner(reopened, readConsent(browserStorage()))) close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, reopened, close])

  if (!CONSENT_BANNER_ENABLED || !open) return null

  return (
    <div ref={region} className={c.banner} role="region" aria-label="Cookie consent" tabIndex={-1}>
      <div className={c.inner}>
        <p className={c.text}>
          Google Analytics counts visits only if you accept. Nothing is sent to Google before that.{' '}
          <a href="/privacy#website-analytics">How we use it</a>
        </p>
        <div className={c.actions}>
          <button type="button" className={c.btn} onClick={() => decide('granted')}>Accept analytics</button>
          <button type="button" className={c.btn} onClick={() => decide('denied')}>Decline</button>
        </div>
      </div>
    </div>
  )
}
