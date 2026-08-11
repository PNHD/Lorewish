import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAutoGrowHeight } from "@/hooks/use-auto-grow-height";
import { readingWidth } from "@/theme/tokens";
import { focusRingStyle, hoverOpacity, type PressableVisualState } from "@/theme/interactive";
import { useAppTheme } from "@/theme/use-app-theme";

import {
  COMPOSER_LINE_HEIGHT,
  COMPOSER_VERTICAL_PADDING,
  composerStyles,
  type ComposerProps,
} from "./composer-shared";

/**
 * Web variant of the shared composer (see composer.tsx for the full
 * contract). Adds the optional desktop send accelerator from
 * docs/UX_CONTRACT.md §3: Ctrl+Enter / Cmd+Enter MAY submit on desktop web.
 * Enter and Shift+Enter still only ever insert newlines — this listener
 * fires on nothing but the modifier combination.
 *
 * Guarded against firing mid-IME-composition (`event.isComposing`): a
 * Vietnamese Telex/VNI or CJK candidate-selection sequence must never be
 * interrupted by this shortcut, even though Ctrl/Cmd+Enter is not how any
 * IME confirms a candidate in practice.
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

  // Kept as a ref so the DOM listener always calls the latest handler
  // without re-attaching itself on every keystroke. Synced in an effect
  // (never during render) so it never mutates a ref as a render side effect.
  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  useEffect(() => {
    // react-native-web forwards this ref straight to the underlying
    // <textarea> DOM node, so raw DOM listener APIs are available here.
    const node = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!node) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const isAccelerator = (event.metaKey || event.ctrlKey) && event.key === "Enter";
      if (!isAccelerator) return;
      event.preventDefault();
      handleSendRef.current();
    };

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, []);

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
        nativeID="lorewish-composer"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline
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
        style={(state: PressableVisualState) => [
          composerStyles.sendButton,
          {
            backgroundColor: colors.accent,
            opacity: hoverOpacity(state, !canSend),
          },
          focusRingStyle(state, colors),
        ]}
      >
        <ThemedText variant="label" color="onAccent">
          {sendLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}
