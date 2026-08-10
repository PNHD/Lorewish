import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

type TextVariant = keyof typeof typography.role;

export type ThemedTextProps = Omit<RNTextProps, "role"> & {
  /**
   * Named `variant`, not `role`: RNTextProps already declares an ARIA
   * `role` (button/heading/link/…). Intersecting that with a same-named
   * prop of our own collapses to only their overlapping literals — exactly
   * the bug this naming avoids.
   */
  variant?: TextVariant;
  color?: "primary" | "secondary" | "onAccent" | "danger";
};

/**
 * The one Text component the app uses for user-facing copy, so type
 * hierarchy (UX_CONTRACT reading-first hierarchy) is enforced once.
 */
export function ThemedText({ variant = "body", color = "primary", style, ...rest }: ThemedTextProps) {
  const { colors } = useAppTheme();
  const colorMap = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    onAccent: colors.textOnAccent,
    danger: colors.danger,
  } as const;

  return (
    <RNText
      style={[typography.role[variant], { color: colorMap[color] }, style]}
      {...rest}
    />
  );
}
