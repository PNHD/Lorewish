const PRODUCTION_ORIGIN = "https://lorewish.pages.dev";

export function isAllowedLorewishOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (origin === PRODUCTION_ORIGIN) return true;
  if (/^https:\/\/[a-z0-9-]+\.lorewish\.pages\.dev$/i.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": isAllowedLorewishOrigin(origin)
      ? (origin ?? PRODUCTION_ORIGIN)
      : PRODUCTION_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
