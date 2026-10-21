'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import CheckoutButtons from '@/components/billing/CheckoutButtons'
import { useAccount } from '@/components/billing/useAccount'
import { billingView, pricingLead, proCardCopy } from '@/components/billing/pricing-state'
import { authErrorMessage, describeSubscription, PRICES } from '@/lib/billing/client'
import s from '@/components/billing/billing.module.css'

function AuthError() {
  const err = authErrorMessage(useSearchParams().get('auth_error'))
  return err ? <p className={s.notice} role="alert">{err}</p> : null
}

export function PricingLead() {
  const { loading, failed, billingEnabled } = useAccount()
  return <p className={s.lead}>{pricingLead(billingView({ loading, failed, billingEnabled }))}</p>
}

// The Pro card. Prices render in the prerendered HTML; the trial and refund promises and any buy button appear
// only once /api/user/me confirms billing is on. The action slot has a fixed height so nothing below it jumps.
export function ProCard() {
  const { loading, failed, user, access, billingEnabled, refresh } = useAccount()
  const view = billingView({ loading, failed, billingEnabled })
  const copy = proCardCopy(view)
  return (
    <section className={`ds-card ${s.tier}`}>
      <h2 className={`ds-display ${s.h2}`}>Pro</h2>
      {copy.priceLine && <p className={s.priceLine}>{PRICES.monthly.label} or {PRICES.yearly.label}</p>}
      {copy.comingSoon && <p className={s.priceLine}>{copy.comingSoon}</p>}
      <ul className={s.list}>
        <li>AR mode: point your phone at the TV</li>
        {copy.terms && <li>3-day free trial, no card</li>}
        {copy.terms && <li>Cancel any time, refund within 14 days of the first payment</li>}
      </ul>
      <Suspense fallback={null}><AuthError /></Suspense>
      <div className={s.action}>
        {view === 'checking' ? <p className={s.notice} role="status">Checking your account...</p>
          : view === 'off' ? <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/camera-vision/ar">Try AR mode free for now</a>
          : view === 'unreachable' ? <p className={s.notice} role="alert">We could not check your account. <button type="button" className={`ds-btn ${s.cta}`} onClick={() => void refresh()}>Try again</button></p>
          : !user ? <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/api/auth/google?next=/pricing">Sign in with Google to start</a>
          : access === 'subscribed' ? <p className={s.notice}>You are subscribed: {describeSubscription(user).headline}. <a href="/account">Manage on your account page</a></p>
          : <CheckoutButtons user={user} onActivated={refresh} />}
      </div>
    </section>
  )
}
