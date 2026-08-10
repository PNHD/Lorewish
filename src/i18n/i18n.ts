import { I18n } from "i18n-js";

import en from "./locales/en.json";
import vi from "./locales/vi.json";
import { DEFAULT_LOCALE } from "./locale";

// i18n-js instance. `locale` is mutated by the LocaleProvider whenever the
// player switches languages; components re-render via the provider's React
// state, not by reading this mutable field directly.
export const i18n = new I18n({ en, vi });

i18n.defaultLocale = DEFAULT_LOCALE;
i18n.locale = DEFAULT_LOCALE;
i18n.enableFallback = true;
