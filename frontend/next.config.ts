import type { NextConfig } from "next";

const apiUrl = process.env.API_INTERNAL_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001");
if (!apiUrl) throw new Error("API_INTERNAL_URL is required for production builds and starts.");
const apiOrigin = new URL(apiUrl);
if (apiOrigin.origin !== apiUrl || (process.env.NODE_ENV === "production" && apiOrigin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(apiOrigin.hostname))) {
  throw new Error("API_INTERNAL_URL must be an origin without a path or trailing slash (HTTPS in production).");
}
if (process.env.NEXT_PUBLIC_API_BASE_URL) {
  throw new Error("Leave NEXT_PUBLIC_API_BASE_URL empty: API requests use the Next.js /api proxy.");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["react-pdf", "pdfjs-dist"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin.origin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
