/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // required for S3 static hosting
  images: {
    unoptimized: true, // required for static export
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
