import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config for first deploy. NOT using r2IncrementalCache yet — that
// needs an R2 bucket binding (a Cloudflare-account step we're deferring).
// ForgeMinds is mostly dynamic SSR + API routes, so ISR cache is not needed
// for the alpha. Add r2IncrementalCache later if/when ISR pages appear.
const config = defineCloudflareConfig({});

// Force a Webpack production build. Next.js 16 builds with Turbopack by
// default, but @opennextjs/cloudflare 1.19.11 cannot load Turbopack's server
// chunks at runtime (ChunkLoadError / "ComponentMod.handler is not a function"
// — see https://opennext.js.org/cloudflare/troubleshooting). OpenNext runs
// setStandaloneBuildMode() (NEXT_PRIVATE_STANDALONE=true) BEFORE this command,
// so the standalone output OpenNext needs is still produced.
config.buildCommand = "next build --webpack";

export default config;
