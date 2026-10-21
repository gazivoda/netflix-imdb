import type { Deps } from './deps'
import { clientBuild, type ClientBuild } from './flag'
import { isSessionConfigured } from './session'

// Ruling V: the paywall is OFF until billing is fully configured, so deploying this code before the
// Google, Paddle, session, checkout and storage variables exist cannot lock visitors out of AR mode.
// It switches on by itself once all seven pieces are present. Evaluated per request from lazily-read env (never at import).
//
// Ruling X: the Paddle client token and the two checkout price ids are NEXT_PUBLIC_* build variables.
// The literal `process.env.NEXT_PUBLIC_*` reads in the default argument are inlined by Next at build time, so
// they reflect the build, not the runtime env; tests inject them. If any is missing at build, billing stays off
// (a paywall without a working checkout would lock users out with nothing to buy).
//
// SEC-4: the users database must live on a persistent volume or every redeploy deletes all accounts. The code
// cannot see the mount, so the owner asserts it with BILLING_DATA_PERSISTENT=true (a runtime variable).
export type { ClientBuild } from './flag'

export function billingConfigured(
  deps: Deps,
  client: ClientBuild = clientBuild(),
  persistent: string | undefined = process.env.BILLING_DATA_PERSISTENT,
): boolean {
  return (
    Boolean(client.token?.trim()) &&
    Boolean(client.monthly?.trim()) &&
    Boolean(client.yearly?.trim()) &&
    persistent?.trim().toLowerCase() === 'true' &&
    Boolean(deps.google) &&
    isSessionConfigured() &&
    Boolean(deps.paddle) &&
    Boolean(deps.webhookSecret) &&
    deps.priceIds.length > 0
  )
}
