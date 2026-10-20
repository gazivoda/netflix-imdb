// Ruling P: the Paddle account is shared with another product, so every event and every verified
// subscription must carry one of OUR price ids. An empty list means "accept nothing" (fail closed).

const split = (v: string | undefined): string[] => (v ?? '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)

// Env is read at call time (never at import) so `next build` needs no billing variables.
export function allowedPriceIds(env: Record<string, string | undefined> = process.env): string[] {
  let ids = split(env.PADDLE_PRICE_IDS)
  if (ids.length === 0) ids = [...split(env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY), ...split(env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY)]
  return Array.from(new Set(ids))
}

// Price ids named by a subscription or transaction payload (items[].price.id or items[].price_id).
export function eventPriceIds(data: any): string[] {
  const items = data && typeof data === 'object' && Array.isArray(data.items) ? data.items : []
  const out: string[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    if (typeof item.price?.id === 'string') out.push(item.price.id)
    if (typeof item.price_id === 'string') out.push(item.price_id)
  }
  return out
}
