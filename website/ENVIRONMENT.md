# Website Environment

## Required (used in code today)

| Variable | Purpose |
|----------|---------|
| **`NEXT_PUBLIC_SITE_URL`** | Canonical site origin (no trailing slash), e.g. `https://www.autoconnecto.in`. Baked into `layout.tsx`, `page.tsx`, `sitemap.ts`, and `robots.ts` at **build** time. |

Copy **`website/.env.example`** to **`website/.env`** for local builds, or set the same variable in CI before `npm run build`.

## Not used by this marketing site

Older templates sometimes listed **Supabase, OpenAI, Gemini, Anthropic, GA, AdSense, Perplexity, Stripe** keys. The current **`website/src`** code does **not** read any of those. If you add analytics, payments, or auth to this Next app later, introduce variables then and document them here.

## Security

- Do **not** commit real API keys or payment keys to git.
- Prefer CI/hosting secrets for anything sensitive when you do add integrations.
