'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import CheckoutButtons from '@/components/billing/CheckoutButtons'
import { useAccount } from '@/components/billing/useAccount'
import { authErrorMessage, BILLING_SOON, describeSubscription } from '@/lib/billing/client'
import s from '@/components/billing/billing.module.css'

function Inner() {
  const { loading, user, access, billingEnabled, refresh } = useAccount()
  const err = authErrorMessage(useSearchParams().get('auth_error'))
  return (
    <div>
      {err && <p className={s.notice} role="alert">{err}</p>}
      {loading ? <p className={s.notice} role="status">Checking your account...</p>
        : !billingEnabled ? <p className={s.notice}>{BILLING_SOON}</p>
        : !user ? <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/api/auth/google?next=/pricing">Sign in with Google to start</a>
        : access === 'subscribed' ? <p className={s.notice}>You are subscribed: {describeSubscription(user).headline}. <a href="/account">Manage on your account page</a></p>
        : <CheckoutButtons user={user} onActivated={refresh} />}
    </div>
  )
}
export default function PricingClient() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
