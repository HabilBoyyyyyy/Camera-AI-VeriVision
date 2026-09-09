/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal self-contained server in .next/standalone, which
  // the Dockerfile copies — keeps the production image small (no
  // node_modules needed at runtime).
  output: 'standalone',
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
