import { cookies } from 'next/headers';
import ArPaywall from '../../../components/billing/ArPaywall';
import { resolveArGate } from '../../../lib/billing/ar-access';
import { defaultDeps } from '../../../lib/billing/deps';
import { SESSION_COOKIE } from '../../../lib/billing/session';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata('/camera-vision/ar');

// Entitlement depends on the cookie, so this segment is rendered per request (reading cookies() does that too).
export const dynamic = 'force-dynamic';

// The paywall is enforced here, on the server: a visitor who is not entitled never receives the AR page, only the
// sign-in / paywall state. Billing off keeps AR open; a failed account lookup is locked, not open (fail closed).
// The parent camera-vision layout supplies the site header and footer.
export default function ArLayout({ children }: { children: React.ReactNode }) {
  const gate = resolveArGate(cookies().get(SESSION_COOKIE)?.value, defaultDeps());
  return gate.kind === 'open' ? <>{children}</> : <ArPaywall gate={gate} />;
}
