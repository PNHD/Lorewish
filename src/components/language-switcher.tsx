import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { radius, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

/**
 * Visible, manual EN/VI switch (LW-M1-R1 §6). Device locale is only the
 * *first* default (src/i18n/context.tsx) — this control always overrides
 * it, and the choice persists locally via AsyncStorage.
 */
export function LanguageSwitcher() {
  const { t, locale, setLocale } = useTranslation();
  const { colors } = useAppTheme();

  const options: { value: "en" | "vi"; label: string }[] = [
    { value: "en", label: t("common.languageEnglish") },
    { value: "vi", label: t("common.languageVietnamese") },
  ];

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("common.languageLabel")}
      style={{ flexDirection: "row", gap: spacing.xs, backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, padding: spacing.xs / 2 }}
    >
      {options.map((option) => {
        const selected = option.value === locale;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setLocale(option.value)}
            style={{
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: selected ? colors.accent : "transparent",
            }}
          >
            <ThemedText variant="label" color={selected ? "onAccent" : "secondary"}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
