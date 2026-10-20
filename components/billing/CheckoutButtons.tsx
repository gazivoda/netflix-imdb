'use client'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'
import { useEffect, useRef, useState } from 'react'
import { paddleConfig, PRICES } from '@/lib/billing/client'
import type { PublicUser } from '@/lib/billing/types'
import s from './billing.module.css'

// Literal reads so Next can inline them at build time.
const CONFIG = paddleConfig({
  NEXT_PUBLIC_PADDLE_ENV: process.env.NEXT_PUBLIC_PADDLE_ENV,
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY,
  NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY,
})

export default function CheckoutButtons({ user, onActivated }: { user: PublicUser; onActivated: () => void }) {
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [state, setState] = useState<'idle' | 'activating' | 'blocked' | 'pending'>('idle')
  const opening = useRef(false)

  useEffect(() => {
    if (!CONFIG) return
    let cancelled = false
    initializePaddle({
      environment: CONFIG.env,
      token: CONFIG.token,
      eventCallback: async (event) => {
        if (event.name !== 'checkout.completed') return
        setState('activating')
        try {
          const res = await fetch('/api/paddle/verify-subscription', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: event.data?.transaction_id }),
          })
          // 202 means Paddle has not created the subscription yet; the webhook will finish it, so poll once more shortly.
          if (res.status === 202) setTimeout(onActivated, 4000)
          setState(res.ok ? 'idle' : 'pending')
        } catch {
          setState('pending')
        }
        onActivated()
      },
    })
      .then((p) => { if (cancelled) return; if (p) setPaddle(p); else setState('blocked') }) // resolves undefined when the script is blocked
      .catch(() => { if (!cancelled) setState('blocked') }) // ad blockers can block paddle.com
    return () => { cancelled = true }
  }, [onActivated])

  if (!CONFIG) return <p className={s.notice}>Subscriptions are unavailable right now. Please check back soon.</p>

  const open = (priceId: string) => {
    if (!paddle || opening.current) return
    opening.current = true
    paddle.Checkout.open({ items: [{ priceId, quantity: 1 }], customData: { userId: user.id }, customer: user.email ? { email: user.email } : undefined })
    setTimeout(() => { opening.current = false }, 1500) // guards a double click opening two checkouts
  }

  return (
    <div className={s.plans}>
      <button type="button" className={`ds-btn ds-btn-signal ${s.plan}`} disabled={!paddle || state === 'activating'} onClick={() => open(CONFIG.monthly)}>
        Monthly <span className={s.price}>{PRICES.monthly.label}</span>
      </button>
      <button type="button" className={`ds-btn ${s.plan}`} disabled={!paddle || state === 'activating'} onClick={() => open(CONFIG.yearly)}>
        Yearly <span className={s.price}>{PRICES.yearly.label}</span>
      </button>
      {state === 'activating' && <p className={s.notice} role="status">Activating your subscription...</p>}
      {state === 'pending' && <p className={s.notice} role="status">Payment received. Your subscription can take a minute to activate; reload this page shortly.</p>}
      {state === 'blocked' && <p className={s.notice} role="alert">Checkout could not load. If you use an ad blocker, allow paddle.com for this site and reload.</p>}
    </div>
  )
}
