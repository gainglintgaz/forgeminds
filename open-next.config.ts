import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config for first deploy. NOT using r2IncrementalCache yet — that
// needs an R2 bucket binding (a Cloudflare-account step we're deferring).
// ForgeMinds is mostly dynamic SSR + API routes, so ISR cache is not needed
// for the alpha. Add r2IncrementalCache later if/when ISR pages appear.
export default defineCloudflareConfig({});
