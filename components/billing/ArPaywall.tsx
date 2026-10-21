'use client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import type { ArGate } from '@/lib/billing/ar-access'
import { describeSubscription } from '@/lib/billing/client'
import ArExplainer from '@/components/ar/ArExplainer'
import CheckoutButtons from './CheckoutButtons'
import s from './billing.module.css'

type Locked = Exclude<ArGate, { kind: 'open' }>

// The sign-in, paywall and "could not check" states of /camera-vision/ar. The server (ar/layout.tsx) decides which one
// to show, so this is already in the HTML: nothing loads after the page and nothing moves. The explainer is the
// same server-rendered description the AR page itself carries, so the URL has real content in every state.
export default function ArPaywall({ gate }: { gate: Locked }) {
  const router = useRouter()
  // The server re-checks the account (cookie and database), so a finished checkout unlocks on refresh.
  const refresh = useCallback(() => router.refresh(), [router])
  const summary = 'user' in gate ? describeSubscription(gate.user) : null
  return (
    <main id="main" tabIndex={-1} className={s.gate}>
      <section className={`ds-card ${s.card}`}>
        <h1 className={`ds-display ${s.title}`}>
          {gate.kind === 'locked' ? 'AR Ratings' : 'AR Ratings is a Pro feature'}
        </h1>
        {gate.kind === 'locked' ? (
          <>
            <p className={s.notice} role="alert">We could not check your account right now.</p>
            <button type="button" className={`ds-btn ${s.cta}`} onClick={refresh}>Try again</button>
          </>
        ) : gate.kind === 'signin' ? (
          <>
            <p className={s.body}>Sign in with Google to start a free 3-day trial. No card needed.</p>
            <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/api/auth/google?next=/camera-vision/ar">Sign in with Google</a>
          </>
        ) : gate.kind === 'paywall' && summary?.canSubscribe ? (
          <>
            <p className={s.body}>Subscribe to keep using AR mode. Cancel any time from your account page.</p>
            <CheckoutButtons user={gate.user} onActivated={refresh} />
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
      <ArExplainer />
    </main>
  )
}
