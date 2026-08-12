/**
 * Lorewish design tokens — minimal foundation, not a full design system.
 *
 * Intent (docs/UX_CONTRACT.md P1/P7, docs/PRODUCT_VISION.md P10): immersive,
 * calm, story-first. Explicitly not a generic AI-gradient dashboard, not a
 * developer-tool aesthetic, not medieval-fantasy parchment — the palette and
 * type must stay comfortable across Fantasy, Romance, Adventure, Mystery,
 * Sci-fi and Slice of Life alike.
 */

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

/** Reading column width cap (UX_CONTRACT §11) — desktop/web never goes full-bleed. */
export const readingWidth = {
  maxContentWidth: 640,
  maxComposerWidth: 640,
} as const;

export const typography = {
  fontFamily: {
    reading: undefined, // system serif-leaning default; a custom reading face is a later decision
    ui: undefined, // system sans default
  },
  role: {
    display: { fontSize: 28, lineHeight: 36, fontWeight: "700" as const },
    heading: { fontSize: 20, lineHeight: 28, fontWeight: "700" as const },
    body: { fontSize: 16, lineHeight: 26, fontWeight: "400" as const },
    narrative: { fontSize: 17, lineHeight: 28, fontWeight: "400" as const },
    caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
    label: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
  },
} as const;

export type ThemeMode = "light" | "dark";

export type SemanticSurfaces = {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textOnAccent: string;
  accent: string;
  accentPressed: string;
  playerAction: string;
  systemChip: string;
  systemChipText: string;
  danger: string;
  /** Personal-limit framing (e.g. near-limit, allowance exhausted) — distinct from `danger`, which is reserved for failures. */
  warning: string;
  warningText: string;
  /** Confirmation framing (e.g. a fact was remembered) — used sparingly, never as decoration. */
  success: string;
  /** Keyboard-focus ring color, shared by every interactive element (Part 19). */
  focus: string;
};

// A warm, low-saturation ink-and-dusk palette — deliberately not a
// blue/purple "AI product" gradient and not parchment/medieval brown.
const lightSurfaces: SemanticSurfaces = {
  background: "#FBF8F4",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceSunken: "#F1ECE3",
  border: "#E4DDD0",
  textPrimary: "#211C16",
  textSecondary: "#6B6153",
  textOnAccent: "#FFFFFF",
  accent: "#8A5A44",
  accentPressed: "#6E4736",
  playerAction: "#4C6B5E",
  systemChip: "#EFE7DA",
  systemChipText: "#5B5041",
  danger: "#A6493A",
  warning: "#8A6A2E",
  warningText: "#8A6A2E",
  success: "#4C6B5E",
  focus: "#3D6E85",
};

const darkSurfaces: SemanticSurfaces = {
  background: "#171310",
  surface: "#211C17",
  surfaceRaised: "#2A231D",
  surfaceSunken: "#120F0C",
  border: "#3A322A",
  textPrimary: "#F3EEE6",
  textSecondary: "#B6AA98",
  textOnAccent: "#1A140F",
  accent: "#D8A280",
  accentPressed: "#C48D68",
  playerAction: "#8FB4A2",
  systemChip: "#2E2721",
  systemChipText: "#C9BCA6",
  danger: "#E08571",
  warning: "#D9B36E",
  warningText: "#D9B36E",
  success: "#8FB4A2",
  focus: "#7EB4CE",
};

export const surfaces: Record<ThemeMode, SemanticSurfaces> = {
  light: lightSurfaces,
  dark: darkSurfaces,
};

/** Opacity levels for interactive states (pressed/disabled), shared across components. */
export const interactiveState = {
  pressedOpacity: 0.7,
  disabledOpacity: 0.4,
  hoverOverlay: "rgba(0,0,0,0.04)",
  hoverOverlayDark: "rgba(255,255,255,0.06)",
  focusRingWidth: 2,
} as const;

/**
 * Motion durations (docs/MOTION_GUIDELINES.md). `reduced*` values are the
 * Reduce Motion fallback (§4) — components choose between the two via
 * `useReducedMotion()`, never animate past the reduced budget when it's on.
 */
export const motion = {
  sceneTransitionMs: 300,
  reducedSceneTransitionMs: 100,
  choiceFeedbackMs: 150,
} as const;
