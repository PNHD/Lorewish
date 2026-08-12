import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { BackLink, ScreenHeaderBar } from "@/components/screen-header-bar";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { getRunState, type RunStateDto } from "@/lib/story-engine";
import { focusRingStyle, hoverOpacity, type PressableVisualState } from "@/theme/interactive";
import { radius, readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export function CharacterDirectoryScreen({ playerRunId }: { playerRunId: string }) {
  const { status: authStatus } = useAuth();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [run, setRun] = useState<RunStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRun(await getRunState(playerRunId));
      setError(null);
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, [playerRunId]);

  useEffect(() => {
    // `load` updates state only after the awaited server read resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (authStatus === "signed_in") void load();
  }, [authStatus, load]);

  if (authStatus === "loading" || (authStatus === "signed_in" && !run && !error)) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeaderBar>
        <BackLink label={t("characters.backToStory")} onPress={() => router.replace(`/play/${playerRunId}`)} />
      </ScreenHeaderBar>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <View style={{ width: "100%", maxWidth: readingWidth.maxContentWidth, alignSelf: "center", gap: spacing.sm }}>
          <ThemedText variant="display" accessibilityRole="header">{t("characters.heading")}</ThemedText>
          <ThemedText variant="body" color="secondary">{t("characters.intro")}</ThemedText>
          {run && <ThemedText variant="caption" color="secondary">{run.branchSeq > 0 ? t("characters.alternatePath") : t("characters.currentPath")}</ThemedText>}
        </View>
        {error && <ThemedText color="danger" style={{ textAlign: "center" }}>{error}</ThemedText>}
        {run?.characters.length === 0 && (
          <View style={{ width: "100%", maxWidth: readingWidth.maxContentWidth, alignSelf: "center", paddingVertical: spacing.xxxl }}>
            <ThemedText variant="body" color="secondary" style={{ textAlign: "center" }}>{t("characters.empty")}</ThemedText>
          </View>
        )}
        {run?.characters.map((character, index) => (
          <View
            key={character.id}
            style={{
              width: "100%",
              maxWidth: readingWidth.maxContentWidth,
              alignSelf: "center",
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
              paddingTop: index === 0 ? 0 : spacing.lg,
              gap: spacing.xs,
            }}
          >
            <ThemedText variant="heading">{character.name}</ThemedText>
            {character.role && <ThemedText variant="label" color="secondary">{character.role}</ThemedText>}
            {character.relationship && <ThemedText variant="body">{character.relationship}</ThemedText>}
            {character.description && <ThemedText variant="caption" color="secondary">{character.description}</ThemedText>}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/play/${playerRunId}/characters/${character.id}`)}
              style={(state: PressableVisualState) => [
                { alignSelf: "flex-start" as const, marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.accent, opacity: hoverOpacity(state) },
                focusRingStyle(state, colors),
              ]}
            >
              <ThemedText variant="label" color="onAccent">{t("characters.openChat")}</ThemedText>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
