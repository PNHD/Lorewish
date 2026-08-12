import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { ChoicePill } from "@/components/choice-pill";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BackLink, ScreenHeaderBar, ScreenHeaderRow } from "@/components/screen-header-bar";
import { ThemedText } from "@/components/themed-text";
import { AdvancedSetupForm } from "@/features/story-setup/advanced-setup-form";
import {
  GENRE_OPTIONS,
  STARTER_OPTIONS,
  toStorySetup,
  validateDraft,
  type GenreId,
  type SetupErrorKey,
  type SetupPath,
  type StorySetupDraft,
} from "@/features/story-setup/model";
import { useStorySetupDraft } from "@/features/story-setup/use-story-setup-draft";
import { useTranslation } from "@/i18n";
import { newTurnId, submitTurn, type ContentLanguage } from "@/lib/story-engine";
import { focusRingStyle, hoverOpacity, type PressableVisualState } from "@/theme/interactive";
import { readingWidth, radius, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export function NewStoryScreen() {
  const { t, locale } = useTranslation();
  const { colors } = useAppTheme();
  const { status, ensureProductSession } = useAuth();
  const { draft, setDraft, clearDraft } = useStorySetupDraft(locale);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SetupErrorKey, true>>>({});

  const update = <K extends keyof StorySetupDraft>(key: K, value: StorySetupDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key in fieldErrors) setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleStart = async () => {
    const nextErrors = validateDraft(draft);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await ensureProductSession();
      const result = await submitTurn({
        turnId: newTurnId(),
        playerRunId: null,
        actionType: "start",
        storySetup: toStorySetup(draft),
      });
      if (result.status === "CONTINUE_READY" || result.status === "EXPLICIT_CHECKPOINT" || result.status === "TERMINAL_ENDING") {
        const playerRunId = await resolveRunId(result);
        clearDraft();
        router.replace({ pathname: "/play/[runId]", params: { runId: playerRunId } });
      } else if (result.status === "ALLOWANCE_EXHAUSTED") {
        setError(t("play.allowanceExhaustedHeading"));
      } else if (result.status === "BETA_CAPACITY_REACHED") {
        setError(t("play.betaCapacityHeading"));
      } else {
        setError(t("play.failedHeading"));
      }
    } catch (caught) {
      const code = (caught as Error).message;
      setError(code === "beta_capacity_reached" ? t("play.betaCapacityHeading") : t("play.failedHeading"));
    } finally {
      setSubmitting(false);
    }
  };

  const advancedCopy: Record<string, string> = {
    storySection: t("setup.storySection"), premise: t("setup.premise"), premisePlaceholder: t("setup.premisePlaceholder"),
    worldSetting: t("setup.worldSetting"), worldPlaceholder: t("setup.worldPlaceholder"), tone: t("setup.tone"),
    toneLight: t("setup.toneLight"), toneBalanced: t("setup.toneBalanced"), toneDark: t("setup.toneDark"), pov: t("setup.pov"),
    povFirst: t("setup.povFirst"), povSecond: t("setup.povSecond"), povThird: t("setup.povThird"), playerSection: t("setup.playerSection"),
    playerRole: t("setup.playerRole"), playerRolePlaceholder: t("setup.playerRolePlaceholder"), playerName: t("setup.playerName"),
    optionalPlaceholder: t("setup.optionalPlaceholder"), playerDescription: t("setup.playerDescription"), playerDescriptionPlaceholder: t("setup.playerDescriptionPlaceholder"),
    characterSection: t("setup.characterSection"), characterName: t("setup.characterName"), characterNamePlaceholder: t("setup.characterNamePlaceholder"),
    characterRole: t("setup.characterRole"), characterRolePlaceholder: t("setup.characterRolePlaceholder"), characterDescription: t("setup.characterDescription"),
    characterDescriptionPlaceholder: t("setup.characterDescriptionPlaceholder"), characterRelationship: t("setup.characterRelationship"),
    characterRelationshipPlaceholder: t("setup.characterRelationshipPlaceholder"), aliases: t("setup.aliases"), aliasesPlaceholder: t("setup.aliasesPlaceholder"),
    addressSection: t("setup.addressSection"), addressHint: t("setup.addressHint"), requiredError: t("setup.requiredError"),
    addressCharacterCallsYou: t("setup.addressCharacterCallsYou"), addressCharacterCallsSelf: t("setup.addressCharacterCallsSelf"),
    addressYouCallCharacter: t("setup.addressYouCallCharacter"), addressYouCallSelf: t("setup.addressYouCallSelf"),
  };
  const starter = STARTER_OPTIONS[draft.genre];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeaderBar>
        <ScreenHeaderRow>
          <BackLink label={t("play.backToHome")} onPress={() => router.push("/")} />
          <LanguageSwitcher />
        </ScreenHeaderRow>
      </ScreenHeaderBar>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", gap: spacing.xl }}>
          <View style={{ gap: spacing.sm }}>
            <ThemedText variant="heading">{t("play.newStoryHeading")}</ThemedText>
            <ThemedText variant="body" color="secondary">{t("setup.subheading")}</ThemedText>
          </View>

          <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: spacing.sm }}>
            {(["quick", "advanced"] as SetupPath[]).map((path) => (
              <ChoicePill key={path} selected={draft.path === path} label={t(path === "quick" ? "setup.quickTab" : "setup.advancedTab")} onPress={() => update("path", path)} />
            ))}
          </View>

          <View style={{ gap: spacing.md }}>
            <ThemedText variant="label">{t("play.languageLabel")}</ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {(["en", "vi"] as ContentLanguage[]).map((language) => (
                <ChoicePill key={language} selected={draft.contentLanguage === language} label={language === "en" ? t("common.languageEnglish") : t("common.languageVietnamese")} onPress={() => update("contentLanguage", language)} />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.md }}>
            <ThemedText variant="label">{t("play.genreLabel")}</ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {GENRE_OPTIONS.map((option) => (
                <ChoicePill key={option.id} selected={draft.genre === option.id} label={option.label} onPress={() => update("genre", option.id as GenreId)} />
              ))}
            </View>
          </View>

          {draft.path === "quick" ? (
            <View style={{ gap: spacing.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg }}>
              <ThemedText variant="label">{t("setup.starterLabel")}</ThemedText>
              <ThemedText variant="body">{starter.premise[draft.contentLanguage]}</ThemedText>
              <ThemedText variant="caption" color="secondary">{starter.character.name} · {starter.character.role}</ThemedText>
            </View>
          ) : (
            <AdvancedSetupForm draft={draft} update={update} errors={fieldErrors} copy={advancedCopy} />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting }}
            disabled={submitting}
            onPress={handleStart}
            style={(state: PressableVisualState) => [
              { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: "center" as const, opacity: hoverOpacity(state, submitting) },
              focusRingStyle(state, colors),
            ]}
          >
            <ThemedText variant="label" color="onAccent">{submitting || status === "guest_creating" ? t("play.creatingStory") : t("play.startButton")}</ThemedText>
          </Pressable>

          {submitting ? <ActivityIndicator /> : null}
          {error ? <ThemedText variant="caption" color="danger" accessibilityLiveRegion="polite">{error}</ThemedText> : null}
          <ThemedText variant="caption" color="secondary">{t("setup.guestPersistenceNote")}</ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function resolveRunId(result: { scene: { runBranchId: string } }): Promise<string> {
  const { getSupabaseClient } = await import("@/lib/supabase");
  const { data, error } = await getSupabaseClient()
    .from("run_branches")
    .select("player_run_id")
    .eq("id", result.scene.runBranchId)
    .single();
  if (error || !data) throw new Error("Could not resolve the new run — please try again.");
  return data.player_run_id as string;
}
