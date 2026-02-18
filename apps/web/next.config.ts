import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Convex backend is at the monorepo root
  // The convex/ directory is at ../../convex relative to apps/web
  transpilePackages: ["@ccs/shared"],
};

export default nextConfig;
