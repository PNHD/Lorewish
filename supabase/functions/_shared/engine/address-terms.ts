import type { ContextCharacter } from "./types.ts";

const VI_PARTICIPANT_TERMS = [
  "anh", "chị", "em", "tôi", "ta", "tớ", "mình", "bạn", "cậu", "ngươi", "mày",
];
const PLAYER_SPEAKERS = new Set(["you", "player", "bạn", "người chơi"]);

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("vi").replace(/\s+/g, " ");
}

function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "ấy" turns a first/second-person term into a third-party reference
  // (e.g. "anh ấy" = "him"), so it is excluded from the direct-address match.
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])(?!\\s+ấy(?:$|[^\\p{L}\\p{N}]))`, "iu");
  return pattern.test(text);
}

function participantTermsDrift(text: string, allowedTerms: string[]): boolean {
  const normalized = normalize(text);
  const allowed = new Set(allowedTerms.map(normalize));
  return VI_PARTICIPANT_TERMS.some((term) => !allowed.has(term) && containsTerm(normalized, term));
}

/**
 * Conservative deterministic guard for the four immutable VI address fields.
 * It inspects only participant dialogue/replies, not narrative references to
 * third parties, so ordinary phrases such as "anh ấy" do not create false
 * failures in prose.
 */
export function storyDialogueHasAddressTermDrift(
  dialogue: { speaker: string; line: string }[],
  characters: ContextCharacter[],
): boolean {
  for (const item of dialogue) {
    const speaker = normalize(item.speaker);
    const character = characters.find((candidate) =>
      [candidate.name, ...candidate.aliases].some((identity) => normalize(identity) === speaker)
    );
    if (character?.addressTerms) {
      if (participantTermsDrift(item.line, [
        character.addressTerms.targetSelfReference,
        character.addressTerms.targetAddressesSpeakerAs,
      ])) return true;
      continue;
    }

    if (PLAYER_SPEAKERS.has(speaker)) {
      const configured = characters.find((candidate) => candidate.addressTerms)?.addressTerms;
      if (configured && participantTermsDrift(item.line, [
        configured.speakerSelfReference,
        configured.speakerAddressesTargetAs,
      ])) return true;
    }
  }
  return false;
}

export function characterReplyHasAddressTermDrift(
  reply: string,
  character: ContextCharacter,
): boolean {
  const terms = character.addressTerms;
  return Boolean(terms && participantTermsDrift(reply, [
    terms.targetSelfReference,
    terms.targetAddressesSpeakerAs,
  ]));
}
