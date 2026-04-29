import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/src/context/AuthContext';
import { ThemeLayout } from '@/src/components/layout/ThemeLayout';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'GearUp | Pro Rentals',
  description: 'Premium P2P Gear Rental for Hyderabad Professionals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} font-sans`}>
      <body>
        <AuthProvider>
          <ThemeLayout>{children}</ThemeLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
