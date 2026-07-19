import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is a monorepo (mobile/ has its own lockfile) — pin the workspace
  // root explicitly so Turbopack doesn't guess.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
