import type { Metadata, Viewport } from 'next';
import { PortalPwa } from '@/features/experiences/portal';

export const metadata: Metadata = {
  title: 'BMN Connect — Portal',
  description: "Your portal",
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BMN Portal' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PortalPwa />
    </>
  );
}
