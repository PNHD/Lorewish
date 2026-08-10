export const SUPPORTED_LOCALES = ["en", "vi"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Reduces a BCP-47 tag ("vi-VN", "en-US") to the two-letter language code
 * this catalogue keys on. Falls back to the default locale if unsupported.
 */
export function normalizeLocale(tag: string | null | undefined): AppLocale {
  if (!tag) return DEFAULT_LOCALE;
  const languageCode = tag.split("-")[0]?.toLowerCase();
  return isSupportedLocale(languageCode) ? languageCode : DEFAULT_LOCALE;
}
