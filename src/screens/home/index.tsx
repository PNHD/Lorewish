import { Link } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { interactiveState, radius, readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: spacing.lg,
            right: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.lg,
          }}
        >
          <Link href="/account" accessibilityRole="link">
            <ThemedText variant="label" color="secondary">
              {t("home.accountLink")}
            </ThemedText>
          </Link>
          <LanguageSwitcher />
        </View>

        <View style={{ maxWidth: readingWidth.maxContentWidth, width: "100%", gap: spacing.lg, alignItems: "center" }}>
          <ThemedText variant="label" color="secondary">
            {t("common.appName")}
          </ThemedText>
          <ThemedText variant="display" style={{ textAlign: "center" }}>
            {t("home.heading")}
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ textAlign: "center" }}>
            {t("home.subheading")}
          </ThemedText>

          <Link href="/play" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => ({
                backgroundColor: colors.accent,
                borderRadius: radius.pill,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xxl,
                opacity: pressed ? interactiveState.pressedOpacity : 1,
              })}
            >
              <ThemedText variant="label" color="onAccent">
                {t("home.newStoryCta")}
              </ThemedText>
            </Pressable>
          </Link>
          <ThemedText variant="caption" color="secondary" style={{ textAlign: "center" }}>
            {t("home.newStoryCaption")}
          </ThemedText>

          <Link href="/preview" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: radius.pill,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xxl,
                opacity: pressed ? interactiveState.pressedOpacity : 1,
              })}
            >
              <ThemedText variant="label">{t("home.previewCta")}</ThemedText>
            </Pressable>
          </Link>
          <ThemedText variant="caption" color="secondary" style={{ textAlign: "center" }}>
            {t("home.previewCaption")}
          </ThemedText>
        </View>

        <ThemedText variant="caption" color="secondary" style={{ textAlign: "center" }}>
          {t("home.foundationNote")}
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}
