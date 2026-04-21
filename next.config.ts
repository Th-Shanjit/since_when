import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // Pin to this package root so Next doesn't climb up and pick a sibling
    // lockfile on the dev machine.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
