'use client'
import { useState } from 'react'
import CheckoutButtons from '@/components/billing/CheckoutButtons'
import { useAccount } from '@/components/billing/useAccount'
import { BILLING_SOON, describeSubscription } from '@/lib/billing/client'
import s from '@/components/billing/billing.module.css'

const PADDLE_SELF_SERVE = 'https://customer.paddle.com/' // Paddle's self-serve fallback, same as Name Habitat

export default function AccountClient() {
  const { loading, user, access, billingEnabled, refresh } = useAccount()
  const [busy, setBusy] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p className={s.notice} role="status">Loading...</p>
  if (!billingEnabled) return <p className={s.notice}>{BILLING_SOON}</p>
  if (!user) return <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/api/auth/google?next=/account">Sign in with Google</a>

  const d = describeSubscription(user)
  // Same-tab navigation: phones block window.open after an await (it is no longer a direct user gesture).
  const openPortal = async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/paddle/portal-session', { credentials: 'same-origin' })
      if (res.status === 401) { setError('Please sign in again.'); return }
      const body = await res.json().catch(() => null)
      window.location.assign(res.ok && body?.url ? body.url : PADDLE_SELF_SERVE)
    } catch {
      window.location.assign(PADDLE_SELF_SERVE)
    } finally { setBusy(false) }
  }
  const signOut = async () => {
    setSigningOut(true); setError(null)
    let ok = false
    try {
      ok = (await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' })).ok
    } catch {
      ok = false
    } finally {
      if (!ok) setError('Sign-out could not reach the server. Taking you home.')
      // Always leave the account page; on failure keep the message readable for a moment first.
      setTimeout(() => window.location.assign('/'), ok ? 0 : 2000)
    }
  }
  const showCheckout = (access === 'paywall' || user.subscription_status === 'trial') && d.canSubscribe

  return (
    <section className={`ds-card ${s.card}`}>
      <p className={`ds-label ${s.label}`}>{user.email}</p>
      <h2 className={`ds-display ${s.h2}`}>{d.headline}</h2>
      <p className={s.body}>{d.detail}</p>
      {showCheckout ? <CheckoutButtons user={user} onActivated={refresh} /> : null}
      {d.canManage && <button type="button" className={`ds-btn ${s.cta}`} disabled={busy} onClick={openPortal}>{busy ? 'Opening...' : 'Manage subscription'}</button>}
      {error && <p className={s.notice} role="alert">{error}</p>}
      <button type="button" className={`ds-btn ${s.cta}`} disabled={signingOut} onClick={signOut}>{signingOut ? 'Signing out...' : 'Sign out'}</button>
    </section>
  )
}
