import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-tools overlay makes its own internal fetch calls; a browser
  // extension that monkey-patches window.fetch (ad blocker, script
  // injector, etc.) can break that call and throw an unhandled rejection
  // in the console. Disabling the overlay removes that code path — Next.js
  // still surfaces real compile/runtime errors either way.
  devIndicators: false,
};

export default nextConfig;
