import { StyleSheet } from "react-native";

import { radius, spacing, typography } from "@/theme/tokens";

export type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  placeholder: string;
  sendLabel: string;
  disabled?: boolean;
};

export const COMPOSER_VERTICAL_PADDING = spacing.sm * 2;
export const COMPOSER_LINE_HEIGHT = typography.role.body.lineHeight;

export const composerStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    width: "100%",
    alignSelf: "center",
  },
  input: {
    flex: 1,
    fontSize: typography.role.body.fontSize,
    lineHeight: COMPOSER_LINE_HEIGHT,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    // No horizontal scrolling under any input length — text must wrap.
    flexWrap: "wrap",
  },
  sendButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
