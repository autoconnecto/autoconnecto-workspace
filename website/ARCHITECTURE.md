# Website Architecture (Next.js App Router)

This document describes the `website/` project as implemented today.

## Framework and build mode (confirmed)

- Next.js App Router using `src/app/*`.
- `next.config.mjs` sets `output: "export"` enabling static export.
- Images are configured as unoptimized for export compatibility.

## Confirmed routes and entrypoints

- `src/app/layout.tsx`
  - global fonts and base metadata
  - imports `src/styles/tailwind.css`
  - injects organization JSON-LD into `<head>`
- `src/app/page.tsx`
  - landing page composition and page-level JSON-LD
- `src/app/not-found.tsx`
  - 404 page (client component)
- `src/app/sitemap.ts`
  - `dynamic = "force-static"` sitemap generation using `NEXT_PUBLIC_SITE_URL`
- `src/app/robots.ts`
  - `dynamic = "force-static"` robots rules; disallows `/api/`, `/_next/`, `/admin/`

## Styling system (confirmed)

- Tailwind CSS configured in `tailwind.config.js`
- Theme tokens defined via CSS variables in `src/styles/tailwind.css`

## Environment usage (confirmed)

- `NEXT_PUBLIC_SITE_URL` is used for:
  - `metadataBase`
  - canonical/open-graph URLs
  - sitemap and robots URLs

## Engineering risks (confirmed)

- Static export + `ignoreBuildErrors` / `ignoreDuringBuilds` can hide broken pages during builds.
- Metadata references `/assets/images/app_logo.png`; `public/` appears empty in this snapshot, so static assets must be verified.

## Current Status

- Static landing page architecture with SEO-focused metadata and structure.

## Next Priorities (recommended)

- Confirm deployment target matches static export assumptions.
- Ensure required static assets exist and are versioned.
- Remove ignored build errors once the site is stable.

