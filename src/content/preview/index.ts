import type { AppLocale } from "@/i18n";

import { previewFixtureEn } from "./en";
import { previewFixtureVi } from "./vi";
import type { PreviewFixture } from "./types";

export * from "./types";

export const previewFixtures: Record<AppLocale, PreviewFixture> = {
  en: previewFixtureEn,
  vi: previewFixtureVi,
};
