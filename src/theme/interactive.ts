import { interactiveState } from "./tokens";
import type { SemanticSurfaces, ThemeMode } from "./tokens";

/**
 * react-native-web's Pressable render-prop state includes `hovered`/`focused`
 * alongside the official `pressed` (verified against
 * node_modules/react-native-web Pressable source — not documented in
 * `@types/react-native`'s `PressableStateCallbackType`). Native Pressable
 * never sets these, so any style built from them is a no-op there by
 * construction — no platform branching needed at call sites.
 */
export type PressableVisualState = { pressed: boolean; hovered?: boolean; focused?: boolean };

/**
 * Keyboard-focus ring (Part 19 / a11y). Web-only CSS `outline` props — react-native-web maps
 * these straight to CSS `outline`, which draws outside the box and never disturbs layout or an
 * element's own background/border. Silently absent on native since `focused` is never true there.
 */
export function focusRingStyle(state: PressableVisualState, colors: SemanticSurfaces) {
  if (!state.focused) return null;
  return {
    outlineWidth: interactiveState.focusRingWidth,
    outlineColor: colors.focus,
    outlineStyle: "solid" as const,
    outlineOffset: 2,
  };
}

/** Opacity step for a hover state on solid/accent-filled controls (Start, Send, primary actions). */
export function hoverOpacity(state: PressableVisualState, disabled?: boolean) {
  if (disabled) return interactiveState.disabledOpacity;
  if (state.pressed) return interactiveState.pressedOpacity;
  if (state.hovered) return 0.88;
  return 1;
}

/** Border color step for a hover state on outlined/neutral controls (choices, pills, cards). */
export function hoverBorderColor(state: PressableVisualState, colors: SemanticSurfaces, selected?: boolean) {
  if (selected) return colors.accent;
  if (state.hovered && !state.pressed) return colors.accent;
  return colors.border;
}

/** Subtle surface tint for a hover state on flat/borderless rows (list items, disclosure headers). */
export function hoverSurfaceTint(state: PressableVisualState, mode: ThemeMode) {
  if (!state.hovered || state.pressed) return undefined;
  return mode === "dark" ? interactiveState.hoverOverlayDark : interactiveState.hoverOverlay;
}
