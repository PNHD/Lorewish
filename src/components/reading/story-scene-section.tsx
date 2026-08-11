import { View } from "react-native";

import { DialogueLine } from "@/components/reading/dialogue-line";
import { NarrativeBlock } from "@/components/reading/narrative-block";
import { StateChangePanel } from "@/components/reading/state-change-panel";
import { ThemedText } from "@/components/themed-text";
import type { SceneDto } from "@/lib/story-engine";
import { readingWidth, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/use-app-theme";

export function StorySceneSection({ scene, whatChanged, isFirst }: { scene: SceneDto; whatChanged: string; isFirst: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: spacing.lg, paddingTop: isFirst ? 0 : spacing.xxxl, borderTopWidth: isFirst ? 0 : 1, borderTopColor: colors.border }}>
      {!isFirst && (
        <View style={{ width: "100%", maxWidth: readingWidth.maxContentWidth, alignSelf: "center" }}>
          <ThemedText variant="caption" color="secondary">{`Scene ${scene.seqInBranch + 1}`}</ThemedText>
        </View>
      )}
      <NarrativeBlock paragraphs={scene.narrative.split(/\n\n+/)} />
      {scene.dialogue.map((line, index) => <DialogueLine key={`${scene.id}:${index}`} speaker={line.speaker} line={line.line} />)}
      {scene.stateChangeSummary.length > 0 && <StateChangePanel heading={whatChanged} items={scene.stateChangeSummary} />}
    </View>
  );
}
