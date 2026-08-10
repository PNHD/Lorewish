import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { radius, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export type PlayStateBadgeProps = {
  label: string;
};

/**
 * Non-blocking badge for EXPLICIT_CHECKPOINT / TERMINAL_ENDING framing
 * (CONTINUOUS_PLAY_CONTRACT §2, G3, G8). Ending-flavoured copy is scoped to
 * the TERMINAL_ENDING fixture node only — this component itself renders
 * whatever label it is given and does not decide play state.
 */
export function PlayStateBadge({ label }: PlayStateBadgeProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: colors.systemChip,
        borderRadius: radius.pill,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
      }}
    >
      <ThemedText variant="caption" style={{ color: colors.systemChipText }}>
        {label}
      </ThemedText>
    </View>
  );
}
