import { defineConfig } from "vitest/config";

// Only the platform-agnostic story-engine code and its tests are exercised
// here. The Expo/React Native app (src/**) has no component test harness in
// this milestone (M2 scope is the engine + a manually/browser-verified
// /play UI, not a React Testing Library suite); Deno-only files
// (supabase-repository.ts, providers.ts, the Edge Function entrypoints) are
// excluded because they use `npm:` specifiers and Deno globals vitest/Node
// cannot resolve — they are reviewed by hand and exercised via the live
// Supabase deploy + HTTP probes instead (see handoff/LW-M2-R1/).
export default defineConfig({
  test: {
    include: ["supabase/functions/_shared/**/*.test.ts"],
    environment: "node",
  },
});
