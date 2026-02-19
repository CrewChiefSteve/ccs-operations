import type { NextConfig } from "next";
import path from "path";

// Resolve React from this app's dependencies, not the monorepo root.
// The monorepo has React 18 (mobile) and React 19 (web); with
// node-linker=hoisted, pnpm may hoist React 18 to root which causes
// "Cannot read properties of null (reading 'useContext')" at build time.
function resolvePackage(pkg: string) {
  try {
    // Resolve from this directory (apps/web) first
    return path.dirname(require.resolve(`${pkg}/package.json`, { paths: [__dirname] }));
  } catch {
    return pkg;
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["@ccs/shared"],

  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      react: resolvePackage("react"),
      "react-dom": resolvePackage("react-dom"),
    };
    return config;
  },
};

export default nextConfig;
