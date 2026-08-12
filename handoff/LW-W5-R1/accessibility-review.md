# LW-W5-R1 — Accessibility Review

Scope: Part 19 baseline (semantic headings, labels, keyboard navigation, focus visibility, correct
button roles, selected/expanded state, accessible validation errors, reasonable contrast, minimum
practical tap targets, Reduce Motion). Behavior assertions preferred over exhaustive snapshotting.

## Semantic headings

Every primary page title now carries `accessibilityRole="header"`. Before this pass, three of six
main screens (Home, Account, Quick/Advanced Setup) were missing it while Story/Characters/Character
Chat already had it — fixed for consistency (`src/screens/home/index.tsx`,
`src/screens/account/index.tsx`, `src/screens/play/new-story.tsx`). Verified live: after the fix, the
accessibility tree for `/play` reports `heading "Start a new story"` where it previously reported a
plain `generic` node.

## Keyboard navigation and focus visibility

Every interactive control touched in this pass (`ChoicePill`, `ActionButton`, `ChoiceList` items, the
composer's Send button, `LanguageSwitcher`, `ScreenHeaderBar`'s `BackLink`, the "Talk to character"
and "Remember in story" buttons, `DisclosureSection`'s toggle) now renders a visible `colors.focus`
outline (`src/theme/interactive.ts` → `focusRingStyle`) instead of relying on an inconsistent
browser default. Verified live by tabbing through `/play` with the keyboard and reading
`getComputedStyle(document.activeElement)`: a focused `ChoicePill` reported
`outlineColor: rgb(61, 110, 133)` (`#3D6E85`, the light-mode `colors.focus` token), `outlineStyle:
solid`, confirming the custom ring — not the browser default — is what's now shown.

`focusRingStyle` is web-only in effect (react-native-web's `Pressable` render-prop state includes
`focused`; native `Pressable` never sets it, so the derived style is a no-op there by construction —
no platform branching needed at call sites).

## Correct roles and selected/expanded state

- Radio-style selectors (`ChoicePill`, `OptionRow`, `LanguageSwitcher`) already carried
  `accessibilityRole="radio"` + `accessibilityState={{ checked }}` / `aria-checked` before this pass;
  unchanged, still correct.
- `DisclosureSection`'s toggle carries `accessibilityRole="button"` +
  `accessibilityState={{ expanded }}` — unchanged, verified still correct after adding hover/focus
  styling on top.
- `StateChangePanel`'s collapse toggle: unchanged, pre-existing and correct.

## Tap targets

`ChoicePill` and `LanguageSwitcher` radios rendered at roughly 28px tall — short of the ~44px
guidance. Rather than enlarging the visible pill (which would work against "no oversized promotional
controls," Part 8), both now set `hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}`, growing the
touch target without changing what's drawn. Other interactive controls (`ChoiceList` items, action
buttons) already used `padding: spacing.md` (12px), giving an effective ~44px height without changes.

## Color contrast

New color tokens (`warning`, `success`, `focus`) checked against every surface they're used on
(WCAG 2.1 contrast ratio, formula per the spec, not a third-party tool):

| Pair | Ratio | Passes AA (4.5:1 text) |
|---|---|---|
| light `warning` (#8A6A2E) on `background` (#FBF8F4) | 4.74 | yes |
| light `warning` on `surface` (#FFFFFF) | 5.02 | yes |
| dark `warning` (#D9B36E) on `background` (#171310) | 9.34 | yes |
| dark `warning` on `surface` (#211C17) | 8.55 | yes |
| light `success` (#4C6B5E) on `background` | 5.55 | yes |
| dark `success` (#8FB4A2) on `background` | 8.11 | yes |
| light `focus` (#3D6E85) on `surface` | 5.57 | yes |
| dark `focus` (#7EB4CE) on `surface` (#2A231D) | 6.86 | yes |

The tightest pair (light `warning` on `background`, 4.74) still clears the 4.5:1 AA threshold for
normal text. `danger`, existing text colors, and `playerAction` were not changed and were already in
use before this pass.

## Accessible validation errors

Advanced Setup's required-field errors (`SetupTextField`) render inline, adjacent to the field,
`color="danger"`, unchanged by this pass — verified still correct. Not re-litigated since no defect
was found here.

## Reduce Motion

`docs/MOTION_GUIDELINES.md` §4 specifies a Reduce Motion contract, but no scene-transition or other
new motion was implemented in this pass (see visual-review.md "What was deliberately left alone" and
HANDOFF.md Known Limitations) — there is currently nothing in the app that *needs* to respect Reduce
Motion, so nothing regresses. `src/hooks/use-reduced-motion.ts` was added ahead of that future work:
it wraps `AccessibilityInfo.isReduceMotionEnabled()` / the `reduceMotionChanged` event, which
react-native-web backs with `matchMedia('(prefers-reduced-motion: reduce)')` — one hook covers both
native and web, verified by reading react-native-web's own `AccessibilityInfo` source
(`node_modules/react-native-web/dist/cjs/exports/AccessibilityInfo/index.js`).

## Not covered in this pass

- Screen-reader-specific manual testing (VoiceOver/TalkBack/NVDA) was not performed live — this
  review is accessibility-tree- and computed-style-based, not assistive-technology-based. Flagging
  honestly rather than claiming coverage that wasn't exercised.
- No automated axe-core/lighthouse accessibility audit was run against the deployed build in this
  pass; the checks above are targeted at what this pass actually changed.
