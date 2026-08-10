import type { PreviewFixture } from "./types";

export const previewFixtureEn: PreviewFixture = {
  startNodeId: "start",
  nodes: {
    start: {
      id: "start",
      boundaryKind: "none",
      narrative: [
        "The gates of Ember Hollow creak open behind you, and the noise of the market rolls out to meet you — woodsmoke, calling vendors, a compass painted on cracked slate above the town well. You have exactly one coin in your pocket and no idea which way home is.",
      ],
      choices: [
        { id: "to-market", label: "Follow the noise into the market", nextId: "market" },
        { id: "to-guard", label: "Ask the gate guard for directions", nextId: "guard" },
      ],
      customActionTargetId: "custom",
    },
    market: {
      id: "market",
      boundaryKind: "checkpoint",
      playerAction: "You follow the noise into the market.",
      narrative: [
        "Between a spice stall and a cage of restless doves, an old woman catches your sleeve. \"You've the look of someone who doesn't know where they're going,\" she says, not unkindly. \"I can point you toward the road — for a story in trade.\" She nods at the coin in your hand like it means nothing to her at all.",
      ],
      dialogue: [
        { speaker: "The Market Woman", line: "A story in trade, and I'll send you off with the right road under your feet." },
      ],
      stateChange: ["Met: the Market Woman", "Noted: she'll trade directions for a story"],
      continueTargetId: "ending",
      customActionTargetId: "ending",
    },
    guard: {
      id: "guard",
      boundaryKind: "checkpoint",
      playerAction: "You ask the gate guard for directions.",
      narrative: [
        "The guard doesn't look up from sharpening his blade. \"Home's a word, not a place, until you say whose,\" he mutters — then relents at your expression. \"North road forks at the old well. Left goes to the hills. Right goes to everywhere else.\" He nods you toward the fork like he's already tired of you.",
      ],
      dialogue: [{ speaker: "The Gate Guard", line: "Left for the hills. Right for everywhere else. Don't make me say it twice." }],
      stateChange: ["Learned: the road forks at the old well", "Relationship — the Gate Guard: wary"],
      continueTargetId: "ending",
      customActionTargetId: "ending",
    },
    custom: {
      id: "custom",
      boundaryKind: "checkpoint",
      narrative: [
        "Whatever you decide, Ember Hollow doesn't wait for you to finish deciding. A cart rattles past, someone shouts a price into the air, and the old woman by the well tilts her head at you like she already knows you're about to ask for help.",
      ],
      stateChange: ["Noted: acted first, asked questions later"],
      continueTargetId: "ending",
      customActionTargetId: "ending",
    },
    ending: {
      id: "ending",
      boundaryKind: "ending",
      playerAction: "You continue on.",
      narrative: [
        "By the time the sun clears the rooftops, you've already got a story worth telling — which, in Ember Hollow, is as good as coin. The road home can wait one more hour.",
      ],
    },
  },
};
