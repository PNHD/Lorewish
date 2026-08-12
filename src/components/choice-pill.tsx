import { Pressable } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { focusRingStyle, hoverBorderColor, type PressableVisualState } from "@/theme/interactive";
import { radius, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export type ChoicePillProps = {
  selected: boolean;
  label: string;
  onPress: () => void;
};

/**
 * Single-select radio pill shared by the Quick/Advanced path tabs, story
 * language, genre, tone, and POV rows (new-story.tsx and
 * advanced-setup-form.tsx previously each defined their own copy of this
 * exact component).
 */
export function ChoicePill({ selected, label, onPress }: ChoicePillProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={(state: PressableVisualState) => [
        {
          borderWidth: 1,
          borderColor: hoverBorderColor(state, colors, selected),
          backgroundColor: selected ? colors.accent : colors.surface,
          borderRadius: radius.pill,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
        },
        focusRingStyle(state, colors),
      ]}
    >
      <ThemedText variant="label" color={selected ? "onAccent" : "primary"}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
