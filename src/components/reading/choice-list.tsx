import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { interactiveState, radius, readingWidth, spacing } from "@/theme/tokens";
import { focusRingStyle, hoverBorderColor, type PressableVisualState } from "@/theme/interactive";
import { useAppTheme } from "@/theme/use-app-theme";

export type Choice = {
  id: string;
  label: string;
};

export type ChoiceListProps = {
  heading: string;
  choices: Choice[];
  onSelect: (choiceId: string) => void;
  disabled?: boolean;
};

/**
 * Predefined choices, rendered as tappable buttons (UX_CONTRACT §7).
 * No numeric allowance/cost is ever rendered beside a choice (UX_CONTRACT
 * §12 / D28) — this fixture has no allowance system, but the component
 * intentionally has no cost-badge slot so a later integration cannot
 * default one in.
 */
export function ChoiceList({ heading, choices, onSelect, disabled }: ChoiceListProps) {
  const { colors } = useAppTheme();
  if (choices.length === 0) return null;

  return (
    <View style={{ maxWidth: readingWidth.maxContentWidth, alignSelf: "center", width: "100%", gap: spacing.sm }}>
      <ThemedText variant="label" color="secondary">
        {heading}
      </ThemedText>
      {choices.map((choice) => (
        <Pressable
          key={choice.id}
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onSelect(choice.id)}
          style={(state: PressableVisualState) => [
            {
              borderWidth: 1,
              borderColor: hoverBorderColor(state, colors),
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              opacity: disabled ? interactiveState.disabledOpacity : state.pressed ? interactiveState.pressedOpacity : 1,
            },
            focusRingStyle(state, colors),
          ]}
        >
          <ThemedText variant="body">{choice.label}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}
