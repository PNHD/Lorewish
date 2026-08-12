import { Pressable } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { radius, spacing } from "@/theme/tokens";
import { focusRingStyle, hoverBorderColor, hoverOpacity, type PressableVisualState } from "@/theme/interactive";
import { useAppTheme } from "@/theme/use-app-theme";

export type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

/**
 * Recovery / continuation action button, shared by the CONTINUE_READY,
 * EXPLICIT_CHECKPOINT and TERMINAL_ENDING states in the local preview
 * fixture. `primary` is the one unambiguous forward action a state offers
 * (e.g. Continue at a checkpoint, per CONTINUOUS_PLAY_CONTRACT G8);
 * `secondary` actions (Replay from here, Start again) are visually
 * subordinate so a checkpoint doesn't read like a terminus.
 */
export function ActionButton({ label, onPress, variant = "primary" }: ActionButtonProps) {
  const { colors } = useAppTheme();
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(state: PressableVisualState) => [
        {
          borderWidth: isPrimary ? 0 : 1,
          borderColor: isPrimary ? undefined : hoverBorderColor(state, colors),
          backgroundColor: isPrimary ? colors.accent : "transparent",
          borderRadius: radius.pill,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          alignItems: "center" as const,
          opacity: hoverOpacity(state),
        },
        focusRingStyle(state, colors),
      ]}
    >
      <ThemedText variant="label" color={isPrimary ? "onAccent" : "primary"}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
