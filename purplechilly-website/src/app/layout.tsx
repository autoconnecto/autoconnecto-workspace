import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://purplechilly.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Purple Chilly — IoT Solutions Company',
    template: '%s | Purple Chilly',
  },
  description:
    'Purple Chilly is an end-to-end IoT solutions company based in Jaipur, India. We design, build, and deploy connected device infrastructure — from hardware integration to cloud platforms — for enterprises across smart energy, fleet, agriculture, and industrial sectors.',
  keywords: [
    'IoT solutions company India',
    'IoT development Jaipur',
    'custom IoT development',
    'ESP32 IoT solutions',
    'MQTT IoT platform',
    'industrial IoT India',
    'smart energy IoT',
    'fleet tracking IoT',
    'IoT consulting',
    'Autoconnecto',
  ],
  authors: [{ name: 'Purple Chilly', url: baseUrl }],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: baseUrl,
    siteName: 'Purple Chilly',
    title: 'Purple Chilly — IoT Solutions Company',
    description:
      'End-to-end IoT solutions — hardware integration, cloud platforms, live dashboards — built for enterprise scale. Based in Jaipur, India.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Purple Chilly — IoT Solutions Company',
    description: 'End-to-end IoT solutions built for enterprise scale.',
    creator: '@purplechilly',
  },
};

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Purple Chilly',
  url: baseUrl,
  description:
    'End-to-end IoT solutions company. We build connected device infrastructure including our platform product Autoconnecto.',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+91-92121-00555',
    contactType: 'customer service',
    areaServed: 'IN',
    availableLanguage: 'English',
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Villa-71, Galaxy Enclave, Mahindra SEZ Road, Kalwara',
    addressLocality: 'Jaipur',
    addressRegion: 'Rajasthan',
    postalCode: '302037',
    addressCountry: 'IN',
  },
  sameAs: [
    'https://autoconnecto.in',
    'https://docs.autoconnecto.in',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
      </head>
      <body className="bg-white text-gray-900 antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
