import { useState } from "react";
import { TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export function SetupTextField({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  multiline = false,
  error,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
  error?: string;
  maxLength?: number;
}) {
  const { colors } = useAppTheme();
  const [contentHeight, setContentHeight] = useState(104);
  const nativeId = `story-setup-${label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
  return (
    <View style={{ gap: spacing.xs }}>
      <ThemedText variant="label">
        {label}
        {required ? " *" : ""}
      </ThemedText>
      <TextInput
        nativeID={nativeId}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        onContentSizeChange={multiline ? (event) => setContentHeight(Math.min(240, Math.max(104, event.nativeEvent.contentSize.height))) : undefined}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          height: multiline ? contentHeight : 48,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          ...typography.role.body,
        }}
      />
      {error ? (
        <ThemedText variant="caption" color="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
