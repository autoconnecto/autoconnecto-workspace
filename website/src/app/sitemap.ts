import { MetadataRoute } from 'next';

export const dynamic = 'force-static'; // ✅ REQUIRED for static export

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return [
    { url: `${base}/`, lastModified: new Date(), priority: 1.0 },
    { url: `${base}/#platform`, lastModified: new Date(), priority: 0.8 },
    { url: `${base}/#features`, lastModified: new Date(), priority: 0.8 },
    { url: `${base}/#contact`, lastModified: new Date(), priority: 0.8 },
  ];
}