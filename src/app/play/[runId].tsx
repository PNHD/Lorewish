import { useLocalSearchParams } from "expo-router";

import { RunScreen } from "@/screens/play/run";

export default function PlayRunRoute() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  return <RunScreen playerRunId={runId} />;
}
