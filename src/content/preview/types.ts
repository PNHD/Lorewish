/**
 * A local, deterministic fixture graph for the /preview route (LW-M1-R1 §8).
 * Not the M2 story engine: no AI, no persistence beyond local UI state. The
 * shape below is deliberately much smaller than the real domain model
 * (docs/DOMAIN_MODEL.md) — it exists to demonstrate the Scene Readability
 * Contract (UX_CONTRACT §1A) and Continuous Play Contract states, not to
 * anticipate the eventual Scene/Branch/CanonFact schema.
 */

export type PreviewBoundaryKind = "none" | "checkpoint" | "ending";

export type PreviewDialogueLine = {
  speaker: string;
  line: string;
};

export type PreviewChoice = {
  id: string;
  label: string;
  nextId: string;
};

export type PreviewNode = {
  id: string;
  boundaryKind: PreviewBoundaryKind;
  /** Shown in the PLAYER ACTION channel when this node is entered via a choice. */
  playerAction?: string;
  narrative: string[];
  dialogue?: PreviewDialogueLine[];
  stateChange?: string[];
  choices?: PreviewChoice[];
  /** Custom-action composer is enabled on this node and routes to this node id. */
  customActionTargetId?: string;
  /** Target for the checkpoint's single primary "Continue" action. */
  continueTargetId?: string;
};

export type PreviewFixture = {
  startNodeId: string;
  nodes: Record<string, PreviewNode>;
};
