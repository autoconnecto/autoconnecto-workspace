import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://purplechilly.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base,               lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/solutions`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/products`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/about`,    lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.7 },
    { url: `${base}/contact`,  lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.8 },
    { url: `${base}/privacy`,  lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terms`,    lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
