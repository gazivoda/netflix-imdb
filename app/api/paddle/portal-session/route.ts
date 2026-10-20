import { handlePortalSession } from '@/lib/billing/handlers'
import { defaultDeps } from '@/lib/billing/deps'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const GET = (req: Request) => handlePortalSession(req, defaultDeps())
