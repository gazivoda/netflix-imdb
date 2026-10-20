import type { Deps } from './deps'
import { isSessionConfigured } from './session'

// Ruling V: the paywall is OFF until billing is fully configured, so deploying this code before the
// Google, Paddle, session and checkout variables exist cannot lock visitors out of AR mode. It switches on by
// itself once all six pieces are present. Evaluated per request from lazily-read env (never at import).
// Ruling X: the Paddle client token is a NEXT_PUBLIC_* build variable. The literal `process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
// (as the default argument) is inlined by Next at build time, so it reflects the build, not the runtime env; tests inject it.
export function billingConfigured(deps: Deps, clientToken: string | undefined = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN): boolean {
  return Boolean(clientToken?.trim()) && Boolean(deps.google) && isSessionConfigured() && Boolean(deps.paddle) && Boolean(deps.webhookSecret) && deps.priceIds.length > 0
}
