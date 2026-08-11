# Gemini Quality Tier (`gemini-3.6-flash`) — Representative English Sample

**Case**: `en-fantasy-01` — a wandering healer arrives at a village bound by a curse tied to speaking the founder's name.

**Status caveat**: this generation is from a **pre-fix** bakeoff pass — before the `language_mixing`
false-positive fix and before the thinking-token cost-accounting fix (both landed later in this
task; see `docs/NARRATIVE_MODEL_EVALUATION.md`). Neither fix affects English structural pass/fail
verdicts, so this EN sample's pass verdict is trustworthy; only its reported cost figure below
undercounts the true cost (thinking tokens were not yet included in `outputTokens`). This is the
**only** `gemini-3.6-flash` bakeoff data this task has — the model's free-tier daily quota
(20 requests/day, confirmed via the API's own error body) was exhausted during this task's testing
before a fully clean quantitative pass could be completed. See COMPARISON.md.

**Excerpt** (first 400 characters — the bakeoff harness's saved report truncates at this length;
full text was not separately captured for this specific generation):

> Unbuckling the worn leather flap of your satchel, you tilt it open so the captain can see inside.
> Bundles of dried feverfew, small stone vials of salve, and copper needles rest in neat linen
> slots. The guard captain leans down, his weathered eyes scanning the tools of your trade before
> he shifts his weight back onto his spear. His tension thins, though his brow remains furrowed as
> he gestures towa… *(truncated)*

**Structural result**: PASS, no repair required.

**Reported metadata** (cost figure undercounts — see caveat above): input tokens 283, output tokens
388 (visible only; thinking tokens not included), reported cost 3335 micro-dollars ($0.003335),
latency 7871ms.
