import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { Composer } from "@/components/composer";
import { BackLink, ScreenHeaderBar } from "@/components/screen-header-bar";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";
import {
  newChatMessageId,
  openCharacterChat,
  promoteChatMemory,
  sendCharacterChatMessage,
  type CharacterChatStateDto,
} from "@/lib/character-chat";
import { interactiveState, radius, readingWidth, spacing } from "@/theme/tokens";
import { focusRingStyle, hoverBorderColor, type PressableVisualState } from "@/theme/interactive";
import { useAppTheme } from "@/theme/use-app-theme";

type SendError = "provider_error" | "transport_error" | "validation_error" | "chat_allowance_exhausted" | "beta_capacity_reached" | "network_error" | null;

export function CharacterChatScreen({ playerRunId, characterId }: { playerRunId: string; characterId: string }) {
  const { status: authStatus } = useAuth();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [chat, setChat] = useState<CharacterChatStateDto | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<SendError>(null);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const state = await openCharacterChat(playerRunId, characterId);
    setChat(state);
    setError(null);
  }, [characterId, playerRunId]);

  useEffect(() => {
    if (authStatus !== "signed_in") return;
    // `load` updates state only after the awaited server read resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((loadError) => setError((loadError as Error).message));
  }, [authStatus, load]);

  useEffect(() => {
    if (!chat) return;
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, [chat]);

  const send = async () => {
    const content = draft.trim();
    if (!content || !chat || sending) return;
    const messageId = pendingMessageId ?? newChatMessageId();
    setPendingMessageId(messageId);
    setSending(true);
    setSendError(null);
    try {
      await sendCharacterChatMessage({ threadId: chat.thread.id, messageId, content });
      setDraft("");
      setPendingMessageId(null);
      await load();
    } catch (sendFailure) {
      const code = (sendFailure as Error).message as SendError;
      setSendError(
        code === "validation_error" || code === "transport_error" || code === "provider_error"
          || code === "chat_allowance_exhausted" || code === "beta_capacity_reached" || code === "network_error"
          ? code
          : "provider_error",
      );
      await load().catch(() => undefined);
    } finally {
      setSending(false);
    }
  };

  const promote = async (messageId: string, candidateIndex: number) => {
    const key = `${messageId}:${candidateIndex}`;
    try {
      await promoteChatMemory(messageId, candidateIndex);
      setPromoted((current) => new Set(current).add(key));
    } catch (promotionError) {
      setError((promotionError as Error).message);
    }
  };

  if (authStatus === "loading" || (authStatus === "signed_in" && !chat && !error)) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenHeaderBar>
          <BackLink label={t("chat.backToStory")} onPress={() => router.replace(`/play/${playerRunId}`)} />
          <ThemedText variant="heading" accessibilityRole="header">{chat?.character.name ?? t("chat.heading")}</ThemedText>
          {chat?.character.storyRelationship && <ThemedText variant="caption" color="secondary">{chat.character.storyRelationship}</ThemedText>}
          <ThemedText variant="caption" color="secondary">{t("chat.nonCanonicalNotice")}</ThemedText>
        </ScreenHeaderBar>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ width: "100%", maxWidth: readingWidth.maxContentWidth, alignSelf: "center", padding: spacing.lg, gap: spacing.lg, flexGrow: 1 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {error && <ThemedText color="danger" style={{ textAlign: "center" }}>{error}</ThemedText>}
          {chat?.messages.length === 0 && (
            <View style={{ flex: 1, justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm }}>
              <ThemedText variant="heading" style={{ textAlign: "center" }}>{t("chat.emptyHeading")}</ThemedText>
              <ThemedText variant="body" color="secondary" style={{ textAlign: "center" }}>{t("chat.emptyBody")}</ThemedText>
            </View>
          )}
          {chat?.messages.map((message) => (
            <View key={message.id} style={{ alignSelf: message.role === "player" ? "flex-end" : "stretch", maxWidth: message.role === "player" ? "84%" : "100%", gap: spacing.sm }}>
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: message.role === "player" ? colors.surfaceSunken : colors.surface, borderWidth: message.role === "character" ? 1 : 0, borderColor: colors.border }}>
                <ThemedText variant="caption" color="secondary">{message.role === "player" ? t("play.youLabel") : chat.character.name}</ThemedText>
                <ThemedText variant="body">{message.content}</ThemedText>
                {message.generation_status === "failed" && <ThemedText variant="caption" color="danger">{t("chat.failedMessage")}</ThemedText>}
              </View>
              {message.role === "character" && message.memory_candidates.map((candidate, candidateIndex) => {
                const key = `${message.id}:${candidateIndex}`;
                // Server truth (candidate.promoted, from canon_facts) is the
                // source of what survives a reload; the local `promoted` set
                // only covers the gap between a successful promote and the
                // next load() round-trip, so the button doesn't flicker back
                // to "Remember in story" for the rest of this session.
                const isPromoted = candidate.promoted || promoted.has(key);
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    disabled={isPromoted}
                    onPress={() => void promote(message.id, candidateIndex)}
                    style={(state: PressableVisualState) => [
                      {
                        alignSelf: "flex-start" as const,
                        borderWidth: 1,
                        borderColor: isPromoted ? colors.success : hoverBorderColor(state, colors),
                        borderRadius: radius.pill,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                        opacity: isPromoted ? interactiveState.disabledOpacity : state.pressed ? interactiveState.pressedOpacity : 1,
                      },
                      focusRingStyle(state, colors),
                    ]}
                  >
                    <ThemedText variant="caption" color={isPromoted ? "success" : "primary"}>{isPromoted ? t("chat.remembered") : t("chat.rememberInStory")}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ))}
          {sending && <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}><ActivityIndicator /><ThemedText variant="caption" color="secondary">{t("chat.sending")}</ThemedText></View>}
          {sendError && (
            <View accessibilityLiveRegion="polite" style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm }}>
              {/* warning = a boundary the player can act on or wait out; danger
                  reserved for a genuine provider/transport failure (P1-3). */}
              <ThemedText variant="label" color={sendError === "provider_error" || sendError === "transport_error" ? "danger" : "warning"}>{
                sendError === "validation_error" ? t("chat.validationError")
                  : sendError === "chat_allowance_exhausted" ? t("chat.allowanceExhausted")
                    : sendError === "beta_capacity_reached" ? t("chat.betaCapacity")
                      : sendError === "network_error" ? t("chat.networkError")
                        : t("chat.providerError")
              }</ThemedText>
              {sendError !== "validation_error" && sendError !== "chat_allowance_exhausted" && sendError !== "beta_capacity_reached" && <Pressable accessibilityRole="button" onPress={() => void send()}><ThemedText variant="label">{t("chat.retry")}</ThemedText></Pressable>}
            </View>
          )}
        </ScrollView>

        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, backgroundColor: colors.background }}>
          <View style={{ width: "100%", maxWidth: readingWidth.maxComposerWidth, alignSelf: "center" }}>
            <Composer value={draft} onChangeText={setDraft} onSend={() => void send()} placeholder={t("chat.placeholder")} sendLabel={t("chat.send")} disabled={sending} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
