import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keeps standalone output under `.next/standalone/` when a parent folder has another lockfile.
  outputFileTracingRoot: path.join(process.cwd()),
  turbopack: {
    root: path.join(process.cwd()),
  },
};

export default nextConfig;
