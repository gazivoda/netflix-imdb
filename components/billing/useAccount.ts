'use client'
import { useCallback, useEffect, useState } from 'react'
import type { AccessStatus, MeResponse, PublicUser } from '@/lib/billing/types'

// billingEnabled is false until the first response, so a slow API never flashes a paywall or sign-in card.
export interface AccountState { loading: boolean; user: PublicUser | null; access: AccessStatus; billingEnabled: boolean; refresh(): Promise<void> }

export function useAccount(): AccountState {
  const [state, setState] = useState<Omit<AccountState, 'refresh'>>({ loading: true, user: null, access: 'no_auth', billingEnabled: false })
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/user/me', { credentials: 'same-origin', cache: 'no-store' })
      const body: Partial<MeResponse> = await res.json()
      setState({ loading: false, user: body.user ?? null, access: body.access ?? 'no_auth', billingEnabled: body.billingEnabled === true })
    } catch {
      // A failed request keeps the old behaviour: signed out, with billing assumed on so the sign-in card shows.
      setState({ loading: false, user: null, access: 'no_auth', billingEnabled: true })
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  return { ...state, refresh }
}
