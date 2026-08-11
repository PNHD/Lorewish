# Gemini Cheap Tier (`gemini-3.5-flash-lite`) — Representative English Sample

**Case**: `en-fantasy-01` — same case as the quality-tier EN sample, for direct comparison.

**Status**: full text, generated after both fixes (language_mixing, thinking-token accounting)
landed. Part of a fully clean 2-pass, 12/12 structural-pass bakeoff run — see COMPARISON.md.

**Full narrative**:

> You flip open the worn leather flap of your satchel, revealing rows of glass vials filled with luminescent salves, dried valerian root, and a set of polished silver lancets. The guard captain's gaze drops to the medical instruments, his rigid posture relaxing by a fraction. He glances back toward the silent, thatched-roof houses of Oakhaven before looking you square in the eye.

**Structural result**: PASS, no repair required.

**Metadata**: input tokens 283, output tokens 311, cost 862 micro-dollars ($0.000862), latency 1967ms.

**Note**: noticeably terser than the quality-tier sample for the same case/prompt (this excerpt is
the model's *complete* output, not truncated) — shorter paragraph, fewer sensory details, but no
structural defects and a comparable narrative register.
