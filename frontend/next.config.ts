import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["three"],
  devIndicators: false,
  experimental: { proxyTimeout: 200000 },
  async rewrites() {
    const backend = process.env.API_INTERNAL_URL || "http://127.0.0.1:8310";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
