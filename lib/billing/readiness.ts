// Pre-launch readiness for turning billing on. Pure: takes the environment and the legal constants and returns what
// still blocks launch, so `npm run billing:readiness` (scripts/billing-readiness.mjs) and the tests share one rule set.
//
// Legal identity is only a blocker once billing is on: until then the empty LEGAL_ADDRESS / GOVERNING_LAW (marked
// TODO(pre-launch) in lib/content.ts) just keep the matching blocks off /privacy and /terms.
// Self-contained on purpose (no imports): scripts/billing-readiness.mjs loads it with Node's native TypeScript stripping,
// which cannot resolve extensionless imports. The billing-on rule mirrors proOnSale() in ./flag.ts; a test keeps them equal.

type Env = Record<string, string | undefined>

export interface Legal { entity: string; address: string; governingLaw: string }
export interface Readiness { billingOn: boolean; blockers: string[]; warnings: string[] }

const set = (v: string | undefined): boolean => Boolean(v?.trim())

export function billingReadiness(env: Env, legal: Legal): Readiness {
  const billingOn =
    set(env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) && set(env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY) && set(env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY)
  const blockers: string[] = []
  const warnings: string[] = []

  if (billingOn) {
    // Paddle review and consumer law want a named seller with an address and a governing law.
    if (!set(legal.entity)) blockers.push('LEGAL_ENTITY is empty in lib/content.ts (TODO pre-launch): name the seller.')
    if (!set(legal.address)) blockers.push('LEGAL_ADDRESS is empty in lib/content.ts (TODO pre-launch): add the operator postal address.')
    if (!set(legal.governingLaw)) blockers.push('GOVERNING_LAW is empty in lib/content.ts (TODO pre-launch): add the governing law and venue.')

    if (!set(env.GOOGLE_CLIENT_ID) || !set(env.GOOGLE_CLIENT_SECRET)) blockers.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set.')
    if (!set(env.JWT_SECRET) || (env.JWT_SECRET ?? '').length < 32) blockers.push('JWT_SECRET must be set to 32 or more characters.')
    if (!set(env.PADDLE_API_KEY)) blockers.push('PADDLE_API_KEY is not set.')
    if (!set(env.PADDLE_WEBHOOK_SECRET)) blockers.push('PADDLE_WEBHOOK_SECRET is not set.')
    if (!set(env.PADDLE_PRICE_IDS)) warnings.push('PADDLE_PRICE_IDS is not set: the price allow-list falls back to the two NEXT_PUBLIC price ids.')
    if (env.BILLING_DATA_PERSISTENT?.trim().toLowerCase() !== 'true') {
      blockers.push('BILLING_DATA_PERSISTENT is not "true": confirm the /app/.data volume exists first (docs/billing/SETUP.md section 3).')
    }
    if (!set(env.OMDB_API_KEY)) blockers.push('OMDB_API_KEY is not set: AR mode cannot look up ratings.')
  } else {
    warnings.push('Billing is off for this build (NEXT_PUBLIC_PADDLE_CLIENT_TOKEN and both NEXT_PUBLIC_PADDLE_PRICE_ID_* must be Build Variables): legal and server checks are skipped.')
  }

  const budget = env.OMDB_DAILY_BUDGET
  if (set(budget)) {
    const n = Number(budget!.trim())
    if (!Number.isInteger(n) || n <= 0) warnings.push('OMDB_DAILY_BUDGET is set but is not a positive integer: the default of 900 is used.')
    else if (n >= 1000) warnings.push('OMDB_DAILY_BUDGET is 1000 or more: the free OMDb tier allows 1000 requests a day, leave a margin.')
  }
  return { billingOn, blockers, warnings }
}
