import { useColorScheme } from "@/hooks/use-color-scheme";

import { surfaces, type ThemeMode } from "./tokens";

export function useAppTheme() {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === "dark" ? "dark" : "light";
  return { mode, colors: surfaces[mode] };
}
