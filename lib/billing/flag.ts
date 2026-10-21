// Is Pro (AR mode) on sale? Decided from the same public checkout values that switch the paywall on
// (lib/billing/config.ts): the Paddle client token and both price ids.
//
// BUILD-TIME FLAG. These are NEXT_PUBLIC_* variables, which Next.js inlines when `next build` runs, and the
// prerendered pages (meta descriptions, JSON-LD offers, the home FAQ, llms.txt) read this flag at build.
// So in Coolify NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY and
// NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY must be Build Variables, and turning billing on needs a REBUILD, not a restart;
// otherwise the static pages keep describing Pro as not on sale. Server-only requirements (Google, JWT, webhook secret,
// BILLING_DATA_PERSISTENT) cannot be seen here: the runtime switch in billingConfigured() stays the gate for access.
export interface ClientBuild { token?: string; monthly?: string; yearly?: string }

// Literal reads, so Next can inline them.
export const clientBuild = (): ClientBuild => ({
  token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  monthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY,
  yearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY,
})

export function proOnSale(client: ClientBuild = clientBuild()): boolean {
  return Boolean(client.token?.trim()) && Boolean(client.monthly?.trim()) && Boolean(client.yearly?.trim())
}

/** Evaluated once per build (module import), like the static pages that use it. */
export const PRO_ON_SALE: boolean = proOnSale()
