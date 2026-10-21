'use client'
import { useCallback, useEffect, useState } from 'react'
import type { AccessStatus, MeResponse, PublicUser } from '@/lib/billing/types'

// billingEnabled is false until the first response, so a slow API never flashes a paywall or sign-in card.
export interface AccountState { loading: boolean; failed: boolean; user: PublicUser | null; access: AccessStatus; billingEnabled: boolean; refresh(): Promise<void> }

export function useAccount(): AccountState {
  const [state, setState] = useState<Omit<AccountState, 'refresh'>>({ loading: true, failed: false, user: null, access: 'no_auth', billingEnabled: false })
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/user/me', { credentials: 'same-origin', cache: 'no-store' })
      const body: Partial<MeResponse> = await res.json()
      setState({ loading: false, failed: false, user: body.user ?? null, access: body.access ?? 'no_auth', billingEnabled: body.billingEnabled === true })
    } catch {
      // Fail closed: an unreachable API must not send people to a sign-in that may not exist. Callers show a retry.
      setState({ loading: false, failed: true, user: null, access: 'no_auth', billingEnabled: false })
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  return { ...state, refresh }
}
