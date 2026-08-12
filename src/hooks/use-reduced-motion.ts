import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * OS-level Reduce Motion (native) / `prefers-reduced-motion` (web — react-native-web's
 * AccessibilityInfo is matchMedia-backed, so this single hook covers both platforms without a
 * `.web.ts` split) per docs/MOTION_GUIDELINES.md §4. Starts `false` and updates once the platform
 * reports a value; never blocks first render.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancelled) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduced;
}
