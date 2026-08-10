import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export type DialogueLineProps = {
  speaker: string;
  line: string;
};

/**
 * The DIALOGUE channel (UX_CONTRACT §1A) — inside the narrative flow with
 * clear speaker attribution, visually distinguished by weight/indentation.
 * Deliberately NOT a chat-bubble transcript: this is a story, not a
 * messaging app.
 */
export function DialogueLine({ speaker, line }: DialogueLineProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        maxWidth: readingWidth.maxContentWidth,
        alignSelf: "center",
        width: "100%",
        paddingLeft: spacing.lg,
        borderLeftWidth: 2,
        borderLeftColor: colors.border,
      }}
    >
      <ThemedText variant="label" color="secondary">
        {speaker}
      </ThemedText>
      <ThemedText variant="narrative">{line}</ThemedText>
    </View>
  );
}
