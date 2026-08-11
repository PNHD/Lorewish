# DeepSeek Quality Tier (`deepseek-v4-pro`) — Representative English Sample

**Case**: `en-fantasy-01` — same case used across all four candidates for direct comparison.

**Status**: full text, generated **after** the thinking-mode fix (`thinking:{type:"disabled"}`) —
see COMPARISON.md and `docs/NARRATIVE_MODEL_EVALUATION.md` for what that bug was and why it
mattered. Part of a fully clean 2-pass, 12/12 structural-pass bakeoff run.

**Full narrative**:

> You open your worn leather satchel, revealing neatly wrapped bundles of dried herbs, small glass vials of tinctures, and a set of clean bandages. The guard captain leans closer, his storm-gray eyes sweeping over the contents. As he straightens, you meet his gaze and ask—keeping your voice gentle—what it is that this village fears so deeply. His jaw tightens, and for a moment he seems to weigh his words carefully. "We fear a sickness that can't be mended by herbs, healer. A sickness of words." He gestures for you to close your satchel, his posture relaxing just a fraction. "But I see you carry no harm. Perhaps the silence can be broken by an outsider's hands."

**Structural result**: PASS, no repair required.

**Metadata**: input tokens 466, output tokens 1468, cost 1480 micro-dollars ($0.00148), latency 21722ms.

**Note on quality**: includes direct in-character dialogue with quoted speech, and the dialogue
itself cleverly reframes the golden case's curse premise ("a sickness of words") without directly
restating the premise text — genuinely creative, non-generic writing. Latency (~22s) and output
token count are both substantially higher than either Gemini tier for the same case, even with
thinking disabled.
