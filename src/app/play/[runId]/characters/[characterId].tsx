import { useLocalSearchParams } from "expo-router";

import { CharacterChatScreen } from "@/screens/play/character-chat";

export default function CharacterChatRoute() {
  const { runId, characterId } = useLocalSearchParams<{ runId: string; characterId: string }>();
  return <CharacterChatScreen playerRunId={runId} characterId={characterId} />;
}
