import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  eslint: {
    // Avoid blocking production builds on ESLint when run in isolated CI environments
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

