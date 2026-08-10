import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { Composer } from "@/components/composer";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { newTurnId, submitTurn, type ContentLanguage } from "@/lib/story-engine";
import { readingWidth, radius, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

const GENRES = ["fantasy", "romance", "adventure", "mystery", "scifi", "comedy", "slice_of_life"] as const;
const GENRE_LABELS: Record<(typeof GENRES)[number], string> = {
  fantasy: "Fantasy",
  romance: "Romance",
  adventure: "Adventure",
  mystery: "Mystery",
  scifi: "Sci-fi",
  comedy: "Comedy",
  slice_of_life: "Slice of Life",
};

/**
 * Quick Start (MVP_SPEC.md §1.2) for the M2 real engine — a single premise
 * field, one primary action, exactly per UX_CONTRACT.md §4. Advanced Setup
 * is out of M2 scope (M3, per ROADMAP.md).
 */
export function NewStoryScreen() {
  const { t, locale } = useTranslation();
  const { colors } = useAppTheme();
  const { status } = useAuth();

  const [premise, setPremise] = useState("");
  const [genre, setGenre] = useState<(typeof GENRES)[number]>("fantasy");
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>(locale);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "signed_out") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <ThemedText variant="body" style={{ textAlign: "center", marginBottom: spacing.lg }}>
          {t("play.signInRequired")}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/account")}
          style={{ backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}
        >
          <ThemedText variant="label" color="onAccent">
            {t("play.goToAccount")}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  const handleStart = async () => {
    const trimmed = premise.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitTurn({
        turnId: newTurnId(),
        playerRunId: null,
        actionType: "start",
        storySetup: { premise: trimmed, genre, contentLanguage, storyMode: "narrative" },
      });
      if (result.status === "CONTINUE_READY" || result.status === "EXPLICIT_CHECKPOINT" || result.status === "TERMINAL_ENDING") {
        const playerRunId = await resolveRunId(result);
        router.replace({ pathname: "/play/[runId]", params: { runId: playerRunId } });
      } else if (result.status === "ALLOWANCE_EXHAUSTED") {
        setError(t("play.allowanceExhaustedHeading"));
      } else {
        setError(t("play.failedHeading"));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable accessibilityRole="link" onPress={() => router.push("/")}>
          <ThemedText variant="label" color="secondary">
            {"‹ "}
            {t("play.backToHome")}
          </ThemedText>
        </Pressable>
        <LanguageSwitcher />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", gap: spacing.md }}>
          <ThemedText variant="heading">{t("play.newStoryHeading")}</ThemedText>
          <ThemedText variant="body" color="secondary">
            {t("play.newStorySubheading")}
          </ThemedText>

          <ThemedText variant="label">{t("play.genreLabel")}</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {GENRES.map((g) => (
                <Pressable
                  key={g}
                  accessibilityRole="button"
                  onPress={() => setGenre(g)}
                  style={{
                    borderWidth: 1,
                    borderColor: g === genre ? colors.accent : colors.border,
                    backgroundColor: g === genre ? colors.accent : colors.surface,
                    borderRadius: radius.pill,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.md,
                  }}
                >
                  <ThemedText variant="label" color={g === genre ? "onAccent" : "primary"}>
                    {GENRE_LABELS[g]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <ThemedText variant="label">{t("play.languageLabel")}</ThemedText>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {(["en", "vi"] as ContentLanguage[]).map((lang) => (
              <Pressable
                key={lang}
                accessibilityRole="button"
                onPress={() => setContentLanguage(lang)}
                style={{
                  borderWidth: 1,
                  borderColor: lang === contentLanguage ? colors.accent : colors.border,
                  backgroundColor: lang === contentLanguage ? colors.accent : colors.surface,
                  borderRadius: radius.pill,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                }}
              >
                <ThemedText variant="label" color={lang === contentLanguage ? "onAccent" : "primary"}>
                  {lang === "en" ? t("common.languageEnglish") : t("common.languageVietnamese")}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText variant="label">{t("play.premiseLabel")}</ThemedText>
          <Composer
            value={premise}
            onChangeText={setPremise}
            onSend={() => handleStart()}
            placeholder={t("play.premisePlaceholder")}
            sendLabel={submitting ? "…" : t("play.startButton")}
            disabled={submitting}
          />

          {submitting && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <ActivityIndicator />
              <ThemedText variant="caption" color="secondary">
                {t("play.generatingScene")}
              </ThemedText>
            </View>
          )}

          {error && (
            <ThemedText variant="caption" color="danger">
              {error}
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * submitTurn's response carries the scene and run_branch_id but not
 * player_run_id directly on a fresh 'start' — this reads it back via a tiny
 * follow-up lookup so the client never needs the RPC to over-return fields
 * it does not otherwise need. Kept intentionally simple for M2: one extra
 * round trip on the rare "start a new story" action only, never on a normal
 * turn.
 */
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
