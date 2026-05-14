import { MetadataRoute } from 'next';

export const dynamic = 'force-static'; // ✅ REQUIRED for static export

function siteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim();
  return raw.replace(/\/+$/, '');
}

export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/admin/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}