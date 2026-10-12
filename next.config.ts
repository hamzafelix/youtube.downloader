import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Self-contained server bundle (.next/standalone) used by the Dockerfile
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
