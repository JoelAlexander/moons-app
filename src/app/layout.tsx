import { NEXT_PUBLIC_URL } from '../config';
import Page from './page';
import type { Metadata } from 'next';

import './global.css';
import '@coinbase/onchainkit/styles.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

export const metadata: Metadata = {
  title: 'Moons',
  description: '',
  openGraph: {
    title: '',
    description: '',
    images: [`${NEXT_PUBLIC_URL}/vibes/vibes-19.png`],
  },
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex items-center justify-center">
        <div className="flex flex-col w-96 md:w-[600px]">
          {children}
        </div>
      </body>
    </html>
  );
}
