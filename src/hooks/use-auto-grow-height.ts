import { useState } from "react";

/**
 * Clamps a multiline TextInput's measured content height between a 1-line
 * minimum and a 7-line maximum (UX_CONTRACT §2). Beyond the max, the
 * TextInput scrolls internally rather than continuing to grow — this is
 * what keeps Send and surrounding chrome on-screen during a long paste.
 *
 * The max is a *line count*, not a fixed pixel height, so it accommodates
 * taller scripts (Vietnamese diacritic stacking, CJK glyph heights) without
 * clipping — each caller passes its own measured single-line height.
 */
export function useAutoGrowHeight(lineHeight: number, verticalPadding: number, maxLines = 7) {
  const minHeight = lineHeight + verticalPadding;
  const maxHeight = lineHeight * maxLines + verticalPadding;
  const [height, setHeight] = useState(minHeight);

  const onContentSizeChange = (contentHeight: number) => {
    const next = Math.max(minHeight, Math.min(maxHeight, contentHeight));
    setHeight(next);
  };

  return {
    height,
    minHeight,
    maxHeight,
    isScrollable: height >= maxHeight,
    onContentSizeChange,
  };
}
