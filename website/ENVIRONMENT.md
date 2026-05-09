# Website Environment

This document describes environment variables present in `website/.env` and how the code uses them.

## Confirmed env file

`website/.env` exists and includes placeholders for:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_ADSENSE_ID`
- `PERPLEXITY_API_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

## Confirmed usage in code

- `NEXT_PUBLIC_SITE_URL` is used in:
  - `src/app/layout.tsx` for `metadataBase` and canonical URLs
  - `src/app/page.tsx` for OpenGraph/Twitter URLs
  - `src/app/sitemap.ts` and `src/app/robots.ts`

No other env vars are confirmed used by `website/src` in this snapshot.

## Security note

Treat `.env` values as secrets. Even if placeholders exist today, real keys should be injected via hosting environment configuration and not committed.

