'use client'
import type { ReactNode } from 'react'
import { describeSubscription, gateDecision, PRICES } from '@/lib/billing/client'
import { useAccount } from './useAccount'
import CheckoutButtons from './CheckoutButtons'
import s from './billing.module.css'

export default function ArGate({ children }: { children: ReactNode }) {
  const { loading, failed, user, access, billingEnabled, refresh } = useAccount()
  const decision = gateDecision({ loading, billingEnabled, user, access })
  // The prerendered HTML is this loading state, so it carries the page's one h1 and an indexable summary.
  if (decision === 'loading') {
    return (
      <main id="main" tabIndex={-1} className={s.gate}>
        <h1 className={`ds-display ${s.title}`}>AR Ratings</h1>
        <p className={s.body}>
          Point your phone at a TV showing Netflix and see IMDb and Rotten Tomatoes scores over each tile, recognised on your device.
          AR mode is a Pro feature with a 3-day free trial, then {PRICES.monthly.label} or {PRICES.yearly.label}.
        </p>
        <p className={s.notice} role="status">Checking your account...</p>
      </main>
    )
  }
  if (failed) {
    return (
      <main id="main" tabIndex={-1} className={s.gate}>
        <h1 className={`ds-display ${s.title}`}>AR Ratings</h1>
        <p className={s.notice} role="alert">We could not check your account.</p>
        <button type="button" className={`ds-btn ${s.cta}`} onClick={() => void refresh()}>Try again</button>
      </main>
    )
  }
  // 'open' = billing not configured yet (AR mode stays free); 'camera' = entitled. Both render the page.
  if (decision === 'open' || decision === 'camera') return <>{children}</>
  const summary = user ? describeSubscription(user) : null
  return (
    <main id="main" tabIndex={-1} className={s.gate}>
      <section className={`ds-card ${s.card}`}>
        <h1 className={`ds-display ${s.title}`}>AR Ratings is a Pro feature</h1>
        {decision === 'signin' || !user ? (
          <>
            <p className={s.body}>Sign in with Google to start a free 3-day trial. No card needed.</p>
            <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/api/auth/google?next=/camera-vision/ar">Sign in with Google</a>
          </>
        ) : decision === 'paywall' && summary?.canSubscribe ? (
          <>
            <p className={s.body}>Subscribe to keep using AR mode. Cancel any time from your account page.</p>
            <CheckoutButtons user={user} onActivated={refresh} />
          </>
        ) : (
          // Ruling Q: a failed renewal is fixed in the billing portal; a second checkout would double-bill.
          <>
            <p className={s.body}>{summary?.detail}</p>
            <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/account">Go to your account</a>
          </>
        )}
        <p className={s.fine}>The Chrome extension and ratings lookups stay free. <a href="/pricing">See pricing</a></p>
      </section>
    </main>
  )
}
