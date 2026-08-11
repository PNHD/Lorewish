import { useEffect, useState } from "react";
import { Platform } from "react-native";

import type { ContentLanguage } from "@/lib/story-engine";

import { createDefaultDraft, type StorySetupDraft } from "./model";

const STORAGE_KEY = "lorewish.story-setup-draft.v1";

function loadDraft(locale: ContentLanguage): StorySetupDraft {
  if (Platform.OS !== "web") return createDefaultDraft(locale);
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    return raw ? ({ ...createDefaultDraft(locale), ...JSON.parse(raw) } as StorySetupDraft) : createDefaultDraft(locale);
  } catch {
    return createDefaultDraft(locale);
  }
}

export function useStorySetupDraft(locale: ContentLanguage) {
  const [draft, setDraft] = useState<StorySetupDraft>(() => loadDraft(locale));

  useEffect(() => {
    if (Platform.OS !== "web") return;
    try {
      globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage can be unavailable in strict/private browsing. In-memory state
      // still preserves every field while moving between setup sections.
    }
  }, [draft]);

  const clearDraft = () => {
    setDraft(createDefaultDraft(locale));
    if (Platform.OS === "web") {
      try {
        globalThis.sessionStorage?.removeItem(STORAGE_KEY);
      } catch {
        // Same non-fatal storage boundary as above.
      }
    }
  };

  return { draft, setDraft, clearDraft };
}
