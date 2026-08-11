import { useLocalSearchParams } from "expo-router";

import { CharacterDirectoryScreen } from "@/screens/play/characters";

export default function CharacterDirectoryRoute() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  return <CharacterDirectoryScreen playerRunId={runId} />;
}
