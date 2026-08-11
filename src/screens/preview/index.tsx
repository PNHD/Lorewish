import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionButton } from "@/components/reading/action-button";
import { ChoiceList } from "@/components/reading/choice-list";
import { DialogueLine } from "@/components/reading/dialogue-line";
import { NarrativeBlock } from "@/components/reading/narrative-block";
import { PlayerActionBanner } from "@/components/reading/player-action-banner";
import { PlayStateBadge } from "@/components/reading/play-state-badge";
import { StateChangePanel } from "@/components/reading/state-change-panel";
import { Composer } from "@/components/composer";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ScreenHeaderBar, ScreenHeaderRow } from "@/components/screen-header-bar";
import { ThemedText } from "@/components/themed-text";
import { previewFixtures } from "@/content/preview";
import { useTranslation } from "@/i18n";
import { readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export function PreviewScreen() {
  const { t, locale } = useTranslation();
  const { colors } = useAppTheme();
  const fixture = previewFixtures[locale];

  const [currentNodeId, setCurrentNodeId] = useState(fixture.startNodeId);
  const [lastCheckpointId, setLastCheckpointId] = useState<string | null>(null);
  const [playerActionOverride, setPlayerActionOverride] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");

  // Switching language resets to the start of that language's fixture — there
  // is no cross-language story state to reconcile in a local fixture. Adjusted
  // synchronously during render (React's documented pattern for resetting
  // state in response to a prop change) rather than in an effect, so the
  // reset is visible in the same render instead of costing an extra pass.
  const [renderedLocale, setRenderedLocale] = useState(locale);
  if (renderedLocale !== locale) {
    setRenderedLocale(locale);
    setCurrentNodeId(fixture.startNodeId);
    setLastCheckpointId(null);
    setPlayerActionOverride(null);
  }

  const node = fixture.nodes[currentNodeId];

  // Same during-render-adjustment pattern: track the most recent checkpoint
  // reached as a derived value rather than syncing it from an effect.
  if (node.boundaryKind === "checkpoint" && lastCheckpointId !== node.id) {
    setLastCheckpointId(node.id);
  }

  const goTo = (nodeId: string) => {
    setPlayerActionOverride(null);
    setCurrentNodeId(nodeId);
  };

  const handleChoice = (choiceId: string) => {
    const choice = node.choices?.find((c) => c.id === choiceId);
    if (choice) goTo(choice.nextId);
  };

  const handleSend = (text: string) => {
    const target = node.customActionTargetId;
    if (!target) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setPlayerActionOverride(trimmed);
    setCurrentNodeId(target);
    setComposerText("");
  };

  const displayedPlayerAction = playerActionOverride ?? node.playerAction;
  const composerEnabled = node.boundaryKind !== "ending" && !!node.customActionTargetId;

  const badgeLabel = useMemo(() => {
    if (node.boundaryKind === "checkpoint") return t("preview.checkpointBadge");
    if (node.boundaryKind === "ending") return t("preview.endingBadge");
    return null;
  }, [node.boundaryKind, t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScreenHeaderBar>
          <ScreenHeaderRow>
            <Link href="/" accessibilityRole="link">
              <ThemedText variant="label" color="secondary">
                {"‹ "}
                {t("preview.backToHome")}
              </ThemedText>
            </Link>
            <LanguageSwitcher />
          </ScreenHeaderRow>
        </ScreenHeaderBar>

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText variant="caption" color="secondary" style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%" }}>
            {t("preview.fixtureNotice")}
          </ThemedText>

          {/* Fixed vertical order per UX_CONTRACT §1A: player action → roll
              result (none in this fixture) → narrative → state change →
              choices → composer. */}
          {displayedPlayerAction && (
            <PlayerActionBanner youLabel={t("preview.youLabel")} action={displayedPlayerAction} />
          )}

          {badgeLabel && <PlayStateBadge label={badgeLabel} />}

          <NarrativeBlock paragraphs={node.narrative} />

          {node.dialogue?.map((line, index) => (
            <DialogueLine key={index} speaker={line.speaker} line={line.line} />
          ))}

          {node.stateChange && node.stateChange.length > 0 && (
            <StateChangePanel heading={t("preview.whatChanged")} items={node.stateChange} />
          )}

          {node.boundaryKind === "none" && node.choices && (
            <ChoiceList heading={t("preview.choicesHeading")} choices={node.choices} onSelect={handleChoice} />
          )}

          {node.boundaryKind === "checkpoint" && node.continueTargetId && (
            <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%" }}>
              <ActionButton label={t("preview.continueLabel")} onPress={() => goTo(node.continueTargetId!)} />
            </View>
          )}

          {node.boundaryKind === "ending" && (
            <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", gap: spacing.sm }}>
              <ActionButton
                label={t("preview.replayFromCheckpointLabel")}
                onPress={() => goTo(lastCheckpointId ?? fixture.startNodeId)}
              />
              <ActionButton
                variant="secondary"
                label={t("preview.startAgainLabel")}
                onPress={() => goTo(fixture.startNodeId)}
              />
            </View>
          )}
        </ScrollView>

        {composerEnabled && (
          <View
            style={{
              padding: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Composer
              value={composerText}
              onChangeText={setComposerText}
              onSend={handleSend}
              placeholder={t("preview.composerPlaceholder")}
              sendLabel={t("preview.composerSend")}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
