import { useState } from "react";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { radius, readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export type StateChangePanelProps = {
  heading: string;
  items: string[];
  /** Collapse to a summary chip once item count exceeds this. */
  collapseThreshold?: number;
};

/**
 * The SYSTEM / STATE CHANGE channel (UX_CONTRACT §1A) — a separate,
 * compact component below the narrative. Never prose, never inline: scene
 * text itself must never contain bracketed mechanical notation.
 *
 * Summarised and collapsed past a small number of items ("3 things
 * changed" → tap to expand) — the story does not stop to enumerate
 * bookkeeping.
 */
export function StateChangePanel({ heading, items, collapseThreshold = 2 }: StateChangePanelProps) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(items.length <= collapseThreshold);

  if (items.length === 0) return null;

  return (
    <View
      style={{
        maxWidth: readingWidth.maxContentWidth,
        alignSelf: "center",
        width: "100%",
        backgroundColor: colors.systemChip,
        borderRadius: radius.sm,
        padding: spacing.sm,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpanded((prev) => !prev)}
        disabled={items.length <= collapseThreshold}
      >
        <ThemedText variant="caption" style={{ color: colors.systemChipText }}>
          {expanded ? heading : `${heading} (${items.length})`}
        </ThemedText>
      </Pressable>
      {expanded && (
        <View style={{ marginTop: spacing.xs, gap: spacing.xs / 2 }}>
          {items.map((item, index) => (
            <ThemedText key={index} variant="caption" style={{ color: colors.systemChipText }}>
              {"•"} {item}
            </ThemedText>
          ))}
        </View>
      )}
    </View>
  );
}
