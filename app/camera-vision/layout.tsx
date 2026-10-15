import './tailwind.css';
import { pageMetadata } from '../../lib/seo';

// page.tsx is a client component and cannot export metadata, so it lives here.
export const metadata = pageMetadata('/camera-vision');

export default function CameraVisionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
