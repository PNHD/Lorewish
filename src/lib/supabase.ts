import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type { Database } from "@/types/database.types";

let cachedClient: SupabaseClient<Database> | undefined;

/**
 * Lazily constructed, not a module-scope `createClient(...)` call: Expo
 * Router's static web export prerenders every route (including `/account`)
 * in a Node SSR pass that does not inline EXPO_PUBLIC_* the way the actual
 * browser/native bundle does. Building the client eagerly at import time
 * crashed that prerender pass for every route, not just this one. Callers
 * only ever run inside a browser/native runtime (event handlers, effects),
 * never during prerendering, so deferring construction until first use
 * sidesteps the SSR context entirely.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill in the lorewish-dev project values."
    );
  }

  // AsyncStorage's web implementation is backed by localStorage, so this one
  // client configuration covers web and native with the same auth
  // abstraction (no platform-specific storage adapter needed at this
  // milestone).
  cachedClient = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Only the web build receives the email-confirmation redirect as a
      // browser URL to parse (native has no OAuth/deep-link callback wired
      // up in this milestone — email/password only, no provider redirects).
      detectSessionInUrl: Platform.OS === "web",
    },
  });
  return cachedClient;
}
