import { pageMetadata } from '../../../lib/seo';

// page.tsx is a client component and cannot export metadata, so it lives here.
// The parent camera-vision layout already supplies the site header and footer.
export const metadata = pageMetadata('/camera-vision/ar');

export default function ArLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
