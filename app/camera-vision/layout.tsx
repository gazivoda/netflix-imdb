import { pageMetadata } from '../../lib/seo';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

// page.tsx is a client component and cannot export metadata, so it lives here.
export const metadata = pageMetadata('/camera-vision');

export default function CameraVisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
