import { describe, expect, it } from "vitest";

import { toCamelScene } from "./story-engine-response";

const common = {
  id: "scene-1",
  narrative: "A door opens.",
  dialogue: [],
};

describe("Story engine response compatibility", () => {
  it("accepts the camelCase Scene returned by the live turn repository", () => {
    expect(toCamelScene({
      ...common,
      runBranchId: "branch-1",
      seqInBranch: 0,
      boundaryKind: "none",
      stateChangeSummary: ["Door opened"],
      nextChoices: [{ id: "enter", label: "Enter" }],
      structuredOutcome: { rolled: false },
    })).toMatchObject({
      runBranchId: "branch-1",
      seqInBranch: 0,
      boundaryKind: "none",
      stateChangeSummary: ["Door opened"],
    });
  });

  it("retains compatibility with snake_case RPC and fixture Scenes", () => {
    expect(toCamelScene({
      ...common,
      run_branch_id: "branch-2",
      seq_in_branch: 1,
      boundary_kind: "checkpoint",
      state_change_summary: [],
      next_choices: [],
      structured_outcome: {},
    })).toMatchObject({
      runBranchId: "branch-2",
      seqInBranch: 1,
      boundaryKind: "checkpoint",
    });
  });
});
