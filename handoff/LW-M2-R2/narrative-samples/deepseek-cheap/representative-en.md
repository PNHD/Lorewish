# DeepSeek Cheap Tier (`deepseek-v4-flash`) — Representative English Sample

**Case**: `en-fantasy-01` — same case used across all four candidates for direct comparison.

**Status**: full text, generated after the thinking-mode fix. Part of the fully clean 2-pass,
11/12 structural-pass bakeoff run (the one remaining failure was on a different case/language and
is documented in `notable-findings/`).

**Full narrative**:

> The guard captain's eyes narrow as you unlatch your satchel and hold it open. He leans in, his gaze moving over the neat rows of dried herbs, the small clay pots of salve, the bone needle and thread. The tension in his shoulders eases a fraction, but his hand stays on the pommel of his sword. "You ask what we fear?" He lets out a short, humorless laugh. "We fear the name of the man who built this village. Say it, and your voice is torn from your throat. Leave you mute as a stone. That's what we fear, healer." A gust of wind carries the smell of woodsmoke and damp earth from the houses beyond the gate.

**Structural result**: PASS, no repair required.

**Metadata**: input tokens 545, output tokens 1069, cost 305 micro-dollars ($0.000305), latency 12437ms.

**Note on quality**: strong, direct dialogue that states the curse mechanic explicitly and
viscerally ("your voice is torn from your throat") — arguably the most vivid single line among all
four candidates' EN samples for this exact case, at the lowest per-generation cost of the four.
