# Notable Finding: Turn-1 Bootstrap Cannot Express Pre-Authored Character Identity

**Severity**: Informational / architecture note (not a provider defect — applies identically to
every provider tested). **Status**: Recorded, not fixed — genuinely out of this task's scope
(structured Character authoring is explicitly M3+, per DOMAIN_MODEL.md).

## What happened

The Narrative Golden Set's fixtures (`golden-set/cases.ts`) specify a `characterIdentity` field per
case — e.g. `en-fantasy-01` designates the guard captain as "Captain Ysolde Marrow" (she/her). This
field is consumed directly by the **bakeoff harness's** one-shot `toContext()` function
(`golden-set/bakeoff.ts`), which builds a `NarrativeContext` by hand for a single isolated call.

The **real production turn-pipeline** (`submitTurn` → `lw_precheck_and_start_turn` →
`StorySetup`) has no equivalent field — `StorySetup` carries only `premise`, `genre`,
`contentLanguage`, and `storyMode`. There is currently no way for a brand-new run's `start` turn to
supply a pre-authored NPC name/gender/identity; the model must invent one from the premise alone.

## Direct evidence

Running this task's continuity test (`continuity-test.ts`, which goes through the **real**
`submitTurn`/`InMemoryTurnRepository` path, not the bakeoff harness's isolated one-shot context) for
`en-fantasy-01` against `deepseek-v4-pro`: the model introduced a guard captain and, since nothing
in the real turn-1 payload named one, generated its own character rather than "Captain Ysolde
Marrow" — genuinely coherent and internally consistent (the invented character's name/gender held
across all 3 turns, discussed in `continuity/en-fantasy-01-deepseek-v4-pro.md`), just not matching
the Golden Set fixture's *designed* identity.

## Why this matters, and why it isn't a provider quality problem

Every candidate model exhibited the same pattern (also observed with `gemini-3.5-flash-lite`'s
sample in this package: the guard captain is described with "his"/"he" pronouns, not matching
"Captain Ysolde Marrow, she/her" either). This is consistent across providers because the payload
they all received was genuinely missing that information — not a model failing to follow
instructions it was given.

## Recommendation

When Character authoring (M3+) or an equivalent enrichment of `StorySetup` is built, the
Golden Set's `characterIdentity` fixtures become directly usable as real acceptance criteria for
"does the model honor a supplied canonical character" — a materially different and stronger test
than what this task's bootstrap payload could exercise. Until then, "prohibited contradiction"
checks against a *pre-authored* name (as several Golden Set cases specify) cannot be meaningfully
evaluated through the real production path — only through the bakeoff harness's separate, richer
one-shot context, which is not what a real player's first turn actually sends.
