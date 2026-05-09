/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // ✅ required for S3 static hosting

  productionBrowserSourceMaps: true,

  // ⚠️ keep default distDir for export compatibility
  // distDir removed intentionally

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    unoptimized: true, // ✅ required for static export
  },
};

export default nextConfig;