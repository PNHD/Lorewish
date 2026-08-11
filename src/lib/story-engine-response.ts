import type { SceneDto } from "./story-engine";

/** Accepts both Edge repository camelCase and RPC/legacy fixture snake_case. */
export function toCamelScene(raw: Record<string, unknown> | null): SceneDto | null {
  if (!raw) return null;
  return {
    id: raw.id as string,
    runBranchId: (raw.runBranchId ?? raw.run_branch_id) as string,
    seqInBranch: (raw.seqInBranch ?? raw.seq_in_branch) as number,
    boundaryKind: (raw.boundaryKind ?? raw.boundary_kind) as SceneDto["boundaryKind"],
    narrative: raw.narrative as string,
    dialogue: (raw.dialogue as SceneDto["dialogue"]) ?? [],
    stateChangeSummary: ((raw.stateChangeSummary ?? raw.state_change_summary) as string[]) ?? [],
    nextChoices: ((raw.nextChoices ?? raw.next_choices) as SceneDto["nextChoices"]) ?? [],
    structuredOutcome: ((raw.structuredOutcome ?? raw.structured_outcome) as Record<string, unknown>) ?? {},
  };
}
