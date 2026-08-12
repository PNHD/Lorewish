import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { focusRingStyle, hoverSurfaceTint, type PressableVisualState } from "@/theme/interactive";
import { radius, readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export type ReplayLinkProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Low-weight per-scene "Replay from here" affordance for scenes *earlier*
 * than the current one (LW-W5-R1 P1-1 / spec Part 12 "replay affordance
 * density"). A full-size ActionButton repeated after every historical scene
 * in a long story reads as a wall of buttons; this is a single right-aligned
 * text-weight control instead — still always reachable (discoverability is
 * preserved per docs/UX_CONTRACT.md §9), just visually subordinate to the
 * narrative it sits under. The current scene's own forward action
 * (checkpoint/ending) keeps the full ActionButton treatment in run.tsx —
 * that one *is* the primary next action, this one is a secondary escape
 * hatch on scenes already read.
 */
export function ReplayLink({ label, onPress, disabled }: ReplayLinkProps) {
  const { colors, mode } = useAppTheme();
  return (
    <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", alignItems: "flex-end" }}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={(state: PressableVisualState) => [
          {
            borderRadius: radius.sm,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
            backgroundColor: hoverSurfaceTint(state, mode),
            opacity: disabled ? 0.6 : 1,
          },
          focusRingStyle(state, colors),
        ]}
      >
        <ThemedText variant="caption" color="secondary">
          {label}
        </ThemedText>
      </Pressable>
    </View>
  );
}
