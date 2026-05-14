import React from 'react';
import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import '../styles/tailwind.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: 'Autoconnecto — Enterprise IoT Platform',
  description:
    'Autoconnecto is a full-stack IoT platform with live dashboards, 50+ widgets, MQTT/HTTPS support, RBAC, alarms engine, and white-label capability for enterprise scale.',
  keywords: ['IoT platform', 'MQTT', 'device management', 'dashboards', 'enterprise IoT', 'white-label'],
  authors: [{ name: 'Autoconnecto' }],
  creator: 'Autoconnecto',
  publisher: 'Autoconnecto',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: `${baseUrl}/`,
  },
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${baseUrl}/`,
    siteName: 'Autoconnecto',
    title: 'Autoconnecto — Enterprise IoT Platform',
    description: 'Full-stack IoT platform for enterprise device management and visualization.',
    images: [
      {
        url: '/assets/images/app_logo.png',
        width: 1200,
        height: 630,
        alt: 'Autoconnecto Enterprise IoT Platform',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Autoconnecto — Enterprise IoT Platform',
    description: 'Full-stack IoT platform for enterprise device management and visualization.',
    images: ['/assets/images/app_logo.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className={dmSans.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Autoconnecto',
              url: `${baseUrl}/`,
              logo: `${baseUrl}/assets/images/app_logo.png`,
              description: 'Enterprise IoT Platform for device management and visualization',
              sameAs: ['https://autoconnecto.in/', 'https://docs.autoconnecto.in/'],
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'Customer Support',
                telephone: '+91-92121-00555',
                areaServed: 'IN',
              },
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Villa-71, Galaxy Enclave, Mahindra SEZ Road, Kalwara',
                addressLocality: 'Jaipur',
                postalCode: '302037',
                addressCountry: 'IN',
              },
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}