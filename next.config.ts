import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Dev shim: lets `next dev` access Cloudflare bindings (.dev.vars) locally.
// No-op in production builds — OpenNext handles the Workers runtime there.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
