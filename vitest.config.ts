import { defineConfig } from "vitest/config";

// Platform-agnostic story-engine and pure product-domain modules are exercised
// here. React Native component rendering remains browser-verified; pure src
// model tests intentionally run in Node without adding a component harness.
// Deno-only files
// (supabase-repository.ts, providers.ts, the Edge Function entrypoints) are
// excluded because they use `npm:` specifiers and Deno globals vitest/Node
// cannot resolve — they are reviewed by hand and exercised via the live
// Supabase deploy + HTTP probes instead (see handoff/LW-M2-R1/).
export default defineConfig({
  test: {
    include: ["supabase/functions/_shared/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
  },
});
