// Pure copy decisions for /pricing and /camera-vision, so the "billing not configured" state cannot promise a
// trial or a purchase that does not exist. Mirrors ArGate: with billing off, AR mode is open to everyone.
export type BillingView = 'checking' | 'on' | 'off' | 'unreachable'

export function billingView(a: { loading: boolean; failed?: boolean; billingEnabled: boolean }): BillingView {
  if (a.loading) return 'checking'
  if (a.failed) return 'unreachable'
  return a.billingEnabled ? 'on' : 'off'
}

export const PRO_NOT_ON_SALE = 'Pro is not on sale yet. AR mode is free to try for now.'

export interface ProCardCopy {
  priceLine: boolean // show the $ prices
  comingSoon: string | null // replaces the price line while billing is off
  terms: boolean // "3-day free trial" and the refund promise
}

// While checking, the prices stay in the prerendered HTML (indexable); the trial and refund promises wait for 'on'.
export function proCardCopy(view: BillingView): ProCardCopy {
  return {
    priceLine: view !== 'off',
    comingSoon: view === 'off' ? PRO_NOT_ON_SALE : null,
    terms: view === 'on',
  }
}

export function pricingLead(view: BillingView): string {
  const base = 'The extension is free. AR mode draws ratings over your TV through your phone camera'
  return view === 'off' ? `${base}, and is free to try while Pro is not on sale yet.` : `${base}, and is the paid feature.`
}

export function arLinkLabel(view: BillingView): string {
  if (view === 'on') return 'Try AR mode (Pro, 3-day trial)'
  if (view === 'off') return 'Try AR mode (free for now)'
  return 'Try AR mode'
}
