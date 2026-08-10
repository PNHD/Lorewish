import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { readingWidth, spacing } from "@/theme/tokens";

export type NarrativeBlockProps = {
  paragraphs: string[];
};

/**
 * The NARRATIVE channel (UX_CONTRACT §1A) — the hero. Full reading column,
 * highest visual weight on the screen, always the first thing the eye lands
 * on when a turn resolves.
 */
export function NarrativeBlock({ paragraphs }: NarrativeBlockProps) {
  return (
    <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", gap: spacing.md }}>
      {paragraphs.map((paragraph, index) => (
        <ThemedText key={index} variant="narrative">
          {paragraph}
        </ThemedText>
      ))}
    </View>
  );
}
