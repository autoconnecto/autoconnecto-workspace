# Autoconnecto Website (Next.js)

## What it is (confirmed)

`website/` is a Next.js 15 App Router project primarily intended as a marketing/landing site.

Confirmed dependencies:
- Next.js `15.1.11`
- React `19.0.3`
- Tailwind CSS

## How to run (confirmed)

From `website/`:

- `npm install`
- `npm run dev` (runs `next dev -p 4028`)
- `npm run build` (runs `next build`)
- `npm run serve` (runs `next start`)

Note: `npm run start` currently runs `next dev -p 4028` (see `website/package.json`).

## Static export (confirmed)

`next.config.mjs` sets:
- `output: "export"` (static export)
- `images.unoptimized: true`

Build ignores:
- TypeScript build errors (`typescript.ignoreBuildErrors: true`)
- ESLint during builds (`eslint.ignoreDuringBuilds: true`)

## Production build & SEO (www + apex)

- Set **`NEXT_PUBLIC_SITE_URL`** to your **primary** marketing origin (no trailing slash), e.g. `https://www.autoconnecto.in`, in **CI and local** before `npm run build`. It is baked into `sitemap.xml`, `robots.txt`, canonical tags, and Open Graph. See **`.env.example`**.
- Upload the full **`out/`** bundle to hosting for **each** hostname that should serve the marketing site. If apex and www both serve the site, use the **same** build so `robots.txt` / `sitemap.xml` match. JSON-LD lists apex and docs as `sameAs` for discovery.
- If apex still 404s on `robots.txt` / `sitemap.xml` while `www` works, fix **CDN/S3 behaviors or redirects** (outside this repo).

## Current Status (confirmed)

- Landing page is composed from section components under `src/app/components/*`.
- SEO metadata, sitemap, and robots routes are implemented.
- No confirmed integration with the platform backend exists in `website/src` in this snapshot.

## Next Priorities (recommended)

- Decide whether the website should stay fully static or integrate with platform services (contact form, signup links, etc.).
- Remove ignored build errors once stable.
- Ensure referenced assets (e.g., `/assets/images/app_logo.png`) exist in the final static hosting output.

# Next.js

A modern Next.js 15 application built with TypeScript and Tailwind CSS.

## 🚀 Features

- **Next.js 15** - Latest version with improved performance and features
- **React 19** - Latest React version with enhanced capabilities
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development

## 🛠️ Installation

1. Install dependencies:
  ```bash
  npm install
  # or
  yarn install
  ```

2. Start the development server:
  ```bash
  npm run dev
  # or
  yarn dev
  ```
3. Open [http://localhost:4028](http://localhost:4028) with your browser to see the result.

## 📁 Project Structure

```
nextjs/
├── public/             # Static assets
├── src/
│   ├── app/            # App router components
│   │   ├── layout.tsx  # Root layout component
│   │   └── page.tsx    # Main page component
│   ├── components/     # Reusable UI components
│   ├── styles/         # Global styles and Tailwind configuration
├── next.config.mjs     # Next.js configuration
├── package.json        # Project dependencies and scripts
├── postcss.config.js   # PostCSS configuration
└── tailwind.config.js  # Tailwind CSS configuration

```

## 🧩 Page Editing

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## 🎨 Styling

This project uses Tailwind CSS for styling with the following features:
- Utility-first approach for rapid development
- Custom theme configuration
- Responsive design utilities
- PostCSS and Autoprefixer integration

## 📦 Available Scripts

- `npm run dev` - Start development server on port 4028
- `npm run build` - Build the application for production
- `npm run start` - Start the development server
- `npm run serve` - Start the production server
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier

## 📱 Deployment

Build the application for production:

  ```bash
  npm run build
  ```

## 📚 Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial

You can check out the [Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 🙏 Acknowledgments

- Built with [Rocket.new](https://rocket.new)
- Powered by Next.js and React
- Styled with Tailwind CSS

Built with ❤️ on Rocket.new