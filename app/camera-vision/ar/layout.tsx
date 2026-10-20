import ArGate from '../../../components/billing/ArGate';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata('/camera-vision/ar');

// The parent camera-vision layout supplies the site header and footer.
export default function ArLayout({ children }: { children: React.ReactNode }) {
  return <ArGate>{children}</ArGate>;
}
