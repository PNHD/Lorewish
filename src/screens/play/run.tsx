import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { ActionButton } from "@/components/reading/action-button";
import { ChoiceList } from "@/components/reading/choice-list";
import { PlayerActionBanner } from "@/components/reading/player-action-banner";
import { PlayStateBadge } from "@/components/reading/play-state-badge";
import { StorySceneSection } from "@/components/reading/story-scene-section";
import { Composer } from "@/components/composer";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import { getRunState, newTurnId, replayFromScene, submitTurn, type SceneDto } from "@/lib/story-engine";
import { readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

type ScreenState =
  | { kind: "loading" }
  | { kind: "ready"; scene: SceneDto; playState: "CONTINUE_READY" | "EXPLICIT_CHECKPOINT" | "TERMINAL_ENDING" }
  | { kind: "generating"; scene: SceneDto; playerActionPreview: string | null }
  | { kind: "failed"; scene: SceneDto; errorClass: string }
  | { kind: "allowance_exhausted"; scene: SceneDto; resetAt: string }
  | { kind: "error"; message: string };

export function RunScreen({ playerRunId }: { playerRunId: string }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { status: authStatus } = useAuth();

  const [state, setState] = useState<ScreenState>({ kind: "loading" });
  const [sceneHistory, setSceneHistory] = useState<SceneDto[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const [composerText, setComposerText] = useState("");
  const [lastPlayerAction, setLastPlayerAction] = useState<string | null>(null);
  const [lastTurnArgs, setLastTurnArgs] = useState<{ actionType: "choice" | "custom_action"; selectedChoiceId?: string; rawAction?: string } | null>(null);
  const [storyHeader, setStoryHeader] = useState<{
    title: string;
    premise: string;
    character: { name: string; role: string | null; relationship: string | null } | null;
    branchSeq: number;
    characterCount: number;
  } | null>(null);

  // If playerRunId changes while this screen stays mounted, reset to the
  // loading state synchronously during render (React's documented pattern
  // for resetting state in response to a prop change — see
  // src/screens/preview/index.tsx for the same idiom used on locale change)
  // rather than an effect, so a real fetch never starts from stale state.
  const [loadedForRunId, setLoadedForRunId] = useState(playerRunId);
  if (loadedForRunId !== playerRunId) {
    setLoadedForRunId(playerRunId);
    setState({ kind: "loading" });
    setSceneHistory([]);
    setStoryHeader(null);
    setComposerText("");
  }

  const load = useCallback(async () => {
    try {
      const run = await getRunState(playerRunId);
      if (!run.scene) {
        setState({ kind: "error", message: "This run has no scenes yet." });
        return;
      }
      setStoryHeader({ title: run.storyTitle, premise: run.storyPremise, character: run.startingCharacter, branchSeq: run.branchSeq, characterCount: run.characters.length });
      setSceneHistory(run.scenes);
      setState({ kind: "ready", scene: run.scene, playState: run.status });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }, [playerRunId]);

  useEffect(() => {
    // The React Compiler lint rule's static analysis flags this as
    // "setState synchronously within an effect" because it sees setState
    // calls inside `load`, but every one of them is behind `await
    // getRunState(...)` — this is the textbook fetch-on-mount effect React's
    // own docs describe ("Subscribe for updates from an external system,
    // calling setState in a callback"), not a synchronous cascading update.
    // Same category of unavoidable false positive as
    // src/hooks/use-color-scheme.web.ts's scoped suppression from M1.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (authStatus === "signed_in") load();
  }, [authStatus, load]);

  useEffect(() => {
    if (sceneHistory.length === 0) return;
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, [sceneHistory.length]);

  const currentScene = "scene" in state ? state.scene : null;

  const runTurn = async (args: { actionType: "choice" | "custom_action"; selectedChoiceId?: string; rawAction?: string; preview: string }) => {
    if (!currentScene) return;
    setLastPlayerAction(args.preview);
    setLastTurnArgs({ actionType: args.actionType, selectedChoiceId: args.selectedChoiceId, rawAction: args.rawAction });
    setState({ kind: "generating", scene: currentScene, playerActionPreview: args.preview });

    try {
      const result = await submitTurn({
        turnId: newTurnId(),
        playerRunId,
        actionType: args.actionType,
        selectedChoiceId: args.selectedChoiceId,
        rawAction: args.rawAction,
      });
      if (result.status === "CONTINUE_READY" || result.status === "EXPLICIT_CHECKPOINT" || result.status === "TERMINAL_ENDING") {
        setComposerText("");
        setSceneHistory((current) => current.some((scene) => scene.id === result.scene.id) ? current : [...current, result.scene]);
        setState({ kind: "ready", scene: result.scene, playState: result.status });
      } else if (result.status === "ALLOWANCE_EXHAUSTED") {
        // Composer text is preserved (G4/G5) — never cleared on a non-committed turn.
        setState({ kind: "allowance_exhausted", scene: currentScene, resetAt: result.resetAt });
      } else if (result.status === "GENERATION_FAILED") {
        setState({ kind: "failed", scene: currentScene, errorClass: result.errorClass });
      } else {
        // in_flight — surface as a failure-recovery state; a retry with a
        // fresh turn_id is the correct next step for the player.
        setState({ kind: "failed", scene: currentScene, errorClass: "in_flight" });
      }
    } catch (err) {
      setState({ kind: "failed", scene: currentScene, errorClass: (err as Error).message });
    }
  };

  const handleChoice = (choiceId: string) => {
    const choice = currentScene?.nextChoices.find((c) => c.id === choiceId);
    if (!choice) return;
    runTurn({ actionType: "choice", selectedChoiceId: choiceId, preview: choice.label });
  };

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    runTurn({ actionType: "custom_action", rawAction: trimmed, preview: trimmed });
  };

  const handleRetry = () => {
    if (!lastTurnArgs) return;
    runTurn({ ...lastTurnArgs, preview: lastPlayerAction ?? "" });
  };

  const handleReplayFromHere = async () => {
    if (!currentScene) return;
    try {
      await replayFromScene(playerRunId, currentScene.id);
      await load();
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  };

  if (authStatus === "signed_out") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <ThemedText variant="body" style={{ textAlign: "center" }}>
          {t("play.signInRequired")}
        </ThemedText>
      </SafeAreaView>
    );
  }

  if (state.kind === "loading" || authStatus === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (state.kind === "error") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <ThemedText variant="body" color="danger" style={{ textAlign: "center" }}>
          {state.message}
        </ThemedText>
      </SafeAreaView>
    );
  }

  const scene = state.scene;
  const isGenerating = state.kind === "generating";
  const composerEnabled = !isGenerating && state.kind !== "allowance_exhausted" && scene.boundaryKind !== "ending" && state.kind !== "failed";
  const displayedPlayerAction = isGenerating ? state.playerActionPreview : lastPlayerAction;

  const badgeLabel =
    state.kind === "ready" && state.playState === "EXPLICIT_CHECKPOINT"
      ? t("play.checkpointBadge")
      : state.kind === "ready" && state.playState === "TERMINAL_ENDING"
        ? t("play.endingBadge")
        : null;

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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {storyHeader && (
          <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", gap: spacing.xs }}>
            <ThemedText variant="heading" accessibilityRole="header">{storyHeader.title}</ThemedText>
            <ThemedText variant="body" color="secondary">{storyHeader.premise}</ThemedText>
            {storyHeader.character && (
              <ThemedText variant="caption" color="secondary">
                {storyHeader.character.name}
                {storyHeader.character.role ? ` · ${storyHeader.character.role}` : ""}
                {storyHeader.character.relationship ? ` · ${storyHeader.character.relationship}` : ""}
              </ThemedText>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md, paddingTop: spacing.sm }}>
              <ThemedText variant="caption" color="secondary">{storyHeader.branchSeq > 0 ? t("play.alternatePath") : t("play.currentPath")}</ThemedText>
              <Pressable accessibilityRole="link" onPress={() => router.push(`/play/${playerRunId}/characters`)}>
                <ThemedText variant="label">{t("play.characters")}{storyHeader.characterCount > 0 ? ` · ${storyHeader.characterCount}` : ""}</ThemedText>
              </Pressable>
            </View>
          </View>
        )}
        {/* Fixed vertical order per UX_CONTRACT §1A. The previous scene stays
            rendered and readable while a next one generates (G6) — this
            screen never swaps the narrative out for a spinner. */}
        {displayedPlayerAction && <PlayerActionBanner youLabel={t("play.youLabel")} action={displayedPlayerAction} />}

        {badgeLabel && <PlayStateBadge label={badgeLabel} />}

        {(sceneHistory.length > 0 ? sceneHistory : [scene]).map((historyScene, index) => (
          <StorySceneSection key={historyScene.id} scene={historyScene} whatChanged={t("play.whatChanged")} isFirst={index === 0} />
        ))}

        {isGenerating && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <ActivityIndicator />
            <ThemedText variant="caption" color="secondary">
              {t("play.generatingScene")}
            </ThemedText>
          </View>
        )}

        {state.kind === "failed" && (
          <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", gap: spacing.sm }}>
            <ThemedText variant="label">{t("play.failedHeading")}</ThemedText>
            <ThemedText variant="caption" color="secondary">
              {t("play.failedBody")}
            </ThemedText>
            <ActionButton label={t("play.retryButton")} onPress={handleRetry} />
          </View>
        )}

        {state.kind === "allowance_exhausted" && (
          <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", gap: spacing.sm }}>
            <ThemedText variant="label">{t("play.allowanceExhaustedHeading")}</ThemedText>
            <ThemedText variant="caption" color="secondary">
              {t("play.allowanceExhaustedBody")}
            </ThemedText>
          </View>
        )}

        {state.kind === "ready" && state.playState !== "TERMINAL_ENDING" && scene.nextChoices.length > 0 && (
          <ChoiceList heading={t("play.choicesHeading")} choices={scene.nextChoices} onSelect={handleChoice} disabled={isGenerating} />
        )}

        {state.kind === "ready" && state.playState === "EXPLICIT_CHECKPOINT" && (
          <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%" }}>
            <ActionButton label={t("play.replayFromHereLabel")} variant="secondary" onPress={handleReplayFromHere} />
          </View>
        )}

        {state.kind === "ready" && state.playState === "TERMINAL_ENDING" && (
          <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", gap: spacing.sm }}>
            <ActionButton label={t("play.endingReplayLabel")} onPress={handleReplayFromHere} />
            <ActionButton variant="secondary" label={t("play.endingNewStoryLabel")} onPress={() => router.push("/play")} />
          </View>
        )}
      </ScrollView>

      {composerEnabled && (
        <View style={{ padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
          <View style={{ width: "100%", maxWidth: readingWidth.maxComposerWidth, alignSelf: "center" }}><Composer
            value={composerText}
            onChangeText={setComposerText}
            onSend={handleSend}
            placeholder={t("play.composerPlaceholder")}
            sendLabel={t("play.composerSend")}
          /></View>
        </View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
