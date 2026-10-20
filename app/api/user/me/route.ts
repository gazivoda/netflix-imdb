import { handleMe } from '@/lib/billing/auth-handlers'
import { defaultDeps } from '@/lib/billing/deps'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const GET = (req: Request) => handleMe(req, defaultDeps())
