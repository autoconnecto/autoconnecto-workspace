import { MetadataRoute } from 'next';

export const dynamic = 'force-static'; // ✅ REQUIRED for static export

/** Canonical origin for sitemap URLs (no trailing slash). Must match production `NEXT_PUBLIC_SITE_URL`. */
function siteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim();
  return raw.replace(/\/+$/, '');
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteOrigin();
  const now = new Date();
  // Single-page marketing site: only real crawlable URLs (fragments like /#features are not separate index entries).
  return [{ url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 }];
}