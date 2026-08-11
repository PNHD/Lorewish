# Continuity Test — English — `deepseek-v4-pro`

**Case**: `en-fantasy-01`. **Run through**: the real `submitTurn`/`InMemoryTurnRepository` pipeline
(not the bakeoff harness's isolated one-shot context), so scene history and recorded canon facts
genuinely carry forward turn-to-turn exactly as they would in production. Post thinking-mode-fix.

**What this tests**: does a fact established in turn 1 (the curse mechanic) persist correctly and
get referenced accurately by turn 3, without being restated in the turn 3 prompt? See
`character-identity-architecture-gap.md` for why the guard captain's name/gender is self-invented
rather than matching the Golden Set's designed "Captain Ysolde Marrow" — a real, documented
limitation of the current turn-1 payload shape, not a continuity failure.

## Turn 1 (start)

> The road to Oakmere winds through thickets of hazel and ash, their branches laced overhead like the roof of a forgotten chapel. You have walked this path for three days, your satchel heavy with poultices and tinctures, the silver serpent of your healer's badge cool against your collarbone. When the trees finally part, the village appears as a huddle of damp thatch and grey stone, crouched around a well whose rope hangs still in the motionless air. No children shriek in play, no merchants call their wares. The only sound is the creak of a loose shutter and the mournful coo of a wood pigeon. A woman in a frayed linen coif pauses on a doorstep, sees you, and presses a finger to her lips before vanishing inside. The silence is so complete you can hear the whisper of your own heartbeat.

## Turn 2 (custom action: the Golden Set case's designed initial decision)

> You slip the strap of your satchel from your shoulder and hold it forward so the worn leather and the glint of glass vials inside catch the fading light. The guard captain—a broad-shouldered man with a rusted chain of office around his neck—steps from the shadow of the well. His eyes flick to the silver serpent at your throat, then to the satchel. For a long moment he simply stares, as if gauging whether you have already guessed the village's secret. Then he gestures for you to follow him into the lee of the smithy, where the anvil's ring has long gone cold. He leans close, his breath smelling of old mint. "We fear a name," he whispers, each word chiseled out. "The founder's name. Speak it, and the silence takes your voice. That's all I can say. Ask me no more." His hand trembles on the pommel of his sword, and you realize he is not threatening you—he is afraid you might ask him to say it himself.

## Turn 3 (generic continuation — no restated facts in the prompt)

> The guard captain's hand still trembles on his sword, and his confession hangs in the cold air between you like a wisp of breath. You notice the deep lines around his eyes—not just age, but the weathering of a long-held terror. He glances toward the well, as if expecting the curse to rise from the stones. When you don't press him, some of the tension leaves his shoulders, though his gaze remains wary. The smithy's shadow offers a sliver of privacy, but you sense others watching from behind shuttered windows.

## Continuity assessment

**PASS.** The curse mechanic established in turns 1–2 (founder's name → silence/voice loss) is
referenced accurately and consistently in turn 3 ("his confession", "expecting the curse to rise
from the stones") without being restated in the turn 3 action. The guard captain's characterization
(male, terrified rather than hostile, physically tense) holds identically across all three turns —
no drift, no contradiction. Recorded canon facts (`curse_mechanic`, `guard_captain_fear`, etc.)
match what the prose actually depicts.
