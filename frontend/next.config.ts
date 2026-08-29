import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["react-pdf", "pdfjs-dist"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
