import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { readingWidth } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export type PlayerActionBannerProps = {
  youLabel: string;
  action: string;
};

/**
 * The PLAYER ACTION channel (UX_CONTRACT §1A) — visually attributable to
 * the player and distinct from AI narrative, so the player can always tell
 * their own words from the story's. First element in the fixed vertical
 * order for a resolved turn.
 */
export function PlayerActionBanner({ youLabel, action }: PlayerActionBannerProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%" }}>
      <ThemedText variant="caption" style={{ color: colors.playerAction }}>
        {youLabel}
      </ThemedText>
      <ThemedText variant="body" style={{ color: colors.playerAction }}>
        {action}
      </ThemedText>
    </View>
  );
}
