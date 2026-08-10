import { useRef, useState } from "react";
import {
  Pressable,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAutoGrowHeight } from "@/hooks/use-auto-grow-height";
import { interactiveState, readingWidth } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

import {
  COMPOSER_LINE_HEIGHT,
  COMPOSER_VERTICAL_PADDING,
  composerStyles,
  type ComposerProps,
} from "./composer-shared";

/**
 * Shared multiline composer, built to docs/UX_CONTRACT.md §2–3:
 * auto-grow 1→7 visible lines then internal scroll, Enter always inserts a
 * newline (never submits — that guarantee alone is why an IME confirmation
 * keystroke can never fire this as a submit, per UX_CONTRACT §2), Send is an
 * explicit always-visible control, no horizontal scrolling, unsent text is
 * caller-controlled state so it survives keyboard close.
 *
 * This is the native/default implementation. See composer.web.tsx for the
 * web variant, which adds the optional Ctrl/Cmd+Enter desktop accelerator
 * (UX_CONTRACT §3) — a control with no native-mobile equivalent.
 *
 * Reused, unmodified, for custom story actions, character chat, and
 * Advanced Setup long fields (all M2+ surfaces) — this is the one
 * implementation the whole product shares.
 */
export function Composer({ value, onChangeText, onSend, placeholder, sendLabel, disabled }: ComposerProps) {
  const { colors } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { height, isScrollable, onContentSizeChange } = useAutoGrowHeight(
    COMPOSER_LINE_HEIGHT,
    COMPOSER_VERTICAL_PADDING,
  );

  const canSend = value.trim().length > 0 && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    onSend(value);
  };

  const handleContentSizeChange = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    onContentSizeChange(event.nativeEvent.contentSize.height);
  };

  return (
    <View
      style={[
        composerStyles.container,
        { borderColor: isFocused ? colors.accent : colors.border, backgroundColor: colors.surface },
      ]}
    >
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline
        // Enter/Return always inserts a newline on every platform — Send is
        // the only submit path (UX_CONTRACT §2). Do not wire onSubmitEditing.
        blurOnSubmit={false}
        editable={!disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onContentSizeChange={handleContentSizeChange}
        scrollEnabled={isScrollable}
        style={[
          composerStyles.input,
          {
            height,
            maxWidth: readingWidth.maxComposerWidth,
            color: colors.textPrimary,
          },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sendLabel}
        disabled={!canSend}
        onPress={handleSend}
        style={({ pressed }) => [
          composerStyles.sendButton,
          {
            backgroundColor: colors.accent,
            opacity: !canSend ? interactiveState.disabledOpacity : pressed ? interactiveState.pressedOpacity : 1,
          },
        ]}
      >
        <ThemedText variant="label" color="onAccent">
          {sendLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}
