// Pure copy decisions for /pricing, so the "billing not configured" state cannot promise a
// trial or a purchase that does not exist. Mirrors ArGate: with billing off, AR mode is open to everyone.
export type BillingView = 'checking' | 'on' | 'off' | 'unreachable'

export function billingView(a: { loading: boolean; failed?: boolean; billingEnabled: boolean }): BillingView {
  if (a.loading) return 'checking'
  if (a.failed) return 'unreachable'
  return a.billingEnabled ? 'on' : 'off'
}

export const PRO_NOT_ON_SALE = 'Pro is not on sale yet. AR mode is free to try for now.'

export const COMING_SOON_BADGE = 'Coming soon'

export interface ProCardCopy {
  priceLine: boolean // show the $ prices (always: they are the plan, on sale or not)
  comingSoon: string | null // explains that checkout is not open yet
  badge: string | null // short "Coming soon" marker next to the prices while billing is off
  terms: boolean // "3-day free trial" and the refund promise
}

// The prices are shown in every state (a reviewer or visitor must be able to see the plan); while billing is off they carry a
// "Coming soon" badge and a disabled checkout. The trial and refund promises wait for 'on'.
export function proCardCopy(view: BillingView): ProCardCopy {
  return {
    priceLine: true,
    comingSoon: view === 'off' ? PRO_NOT_ON_SALE : null,
    badge: view === 'off' ? COMING_SOON_BADGE : null,
    terms: view === 'on',
  }
}

export function pricingLead(view: BillingView): string {
  const base = 'The extension is free. AR mode draws ratings over your TV through your phone camera'
  return view === 'off' ? `${base}, and is free to try while Pro is not on sale yet.` : `${base}, and is the paid feature.`
}

// Static on purpose: the label used to change once the account check finished, which moved the buttons and the stage
// below them (layout shift). The AR page itself says whether it is free or Pro.
export const AR_LINK_LABEL = 'Try AR mode'
