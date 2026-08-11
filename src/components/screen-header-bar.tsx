import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { focusRingStyle, hoverSurfaceTint, type PressableVisualState } from "@/theme/interactive";
import { radius, readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

/**
 * Shared screen chrome bar. The border/background bleed full-width (a
 * conventional desktop header treatment), but the content inside is
 * constrained to the same reading-column width as the screen body below it
 * and centered — previously every screen's header row went full-bleed while
 * its content sat in a centered narrow column, which is exactly what made
 * desktop read as "a mobile page stretched wide" rather than a considered
 * layout (LW-W5-R1 P1-6). Behavior-neutral: layout only.
 */
export function ScreenHeaderBar({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
      <View style={{ maxWidth: readingWidth.maxContentWidth, width: "100%", alignSelf: "center", gap: spacing.xs }}>
        {children}
      </View>
    </View>
  );
}

export function ScreenHeaderRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>{children}</View>;
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, mode } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={(state: PressableVisualState) => [
        {
          borderRadius: radius.sm,
          marginLeft: -spacing.xs,
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.xs / 2,
          backgroundColor: hoverSurfaceTint(state, mode),
        },
        focusRingStyle(state, colors),
      ]}
    >
      <ThemedText variant="label" color="secondary">
        {"‹ "}
        {label}
      </ThemedText>
    </Pressable>
  );
}
