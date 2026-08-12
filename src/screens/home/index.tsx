import { Link, router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { focusRingStyle, hoverOpacity, type PressableVisualState } from "@/theme/interactive";
import { radius, readingWidth, spacing } from "@/theme/tokens";
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
          gap: spacing.xxl,
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

        {/* Story-first hero: one unmistakable primary action. The offline
            preview (below) is internal QA/demo infrastructure and must never
            compete with it — see docs handoff/LW-W5-R1/ux-audit.md P0-1. */}
        <View style={{ maxWidth: readingWidth.maxContentWidth, width: "100%", gap: spacing.lg, alignItems: "center" }}>
          <ThemedText variant="label" color="secondary">
            {t("common.appName")}
          </ThemedText>
          <ThemedText variant="display" accessibilityRole="header" style={{ textAlign: "center" }}>
            {t("home.heading")}
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ textAlign: "center" }}>
            {t("home.subheading")}
          </ThemedText>

          {/* Plain Pressable + router.push, not <Link asChild> — Link's
              child-cloning does not compose correctly with an array-valued
              function style (confirmed via screenshot: background/text
              rendered at near-zero opacity). Every other primary button in
              the app already uses this same onPress pattern. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/play")}
            style={(state: PressableVisualState) => [
              {
                backgroundColor: colors.accent,
                borderRadius: radius.pill,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xxl,
                opacity: hoverOpacity(state),
              },
              focusRingStyle(state, colors),
            ]}
          >
            <ThemedText variant="label" color="onAccent">
              {t("home.newStoryCta")}
            </ThemedText>
          </Pressable>
          <ThemedText variant="caption" color="secondary" style={{ textAlign: "center" }}>
            {t("home.newStoryCaption")}
          </ThemedText>
        </View>

        <View style={{ gap: spacing.xs, alignItems: "center" }}>
          <Link href="/preview" accessibilityRole="link">
            <ThemedText variant="caption" color="secondary" style={{ textDecorationLine: "underline" }}>
              {t("home.previewCta")}
            </ThemedText>
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
