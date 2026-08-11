# Notable Finding: `language_mixing` False Positive on Vietnamese Diacritics

**Severity**: High (corrupted this task's own Vietnamese structural-pass/repair-rate evidence
until found and fixed). **Status**: Fixed during this task (commit `9ab8f25`), regression-tested.

## What happened

`quality-gate.ts`'s `detectLanguageMixing` used the regex `\b[a-zA-Z]+(?:\s+[a-zA-Z]+){3,}\b` to
catch a run of 4+ consecutive English-looking words embedded in Vietnamese prose. JavaScript's
`\b`/`\w` are ASCII-only — a Vietnamese diacritic letter (e.g. "ắ" in "mắt") is treated as a
non-word character, so the regex silently split a single correct Vietnamese word into ASCII
fragments (e.g. "mắt" → the fragment "m"), which could then chain with genuinely separate words
into a false 4-token "English run."

## Direct evidence (real `gemini-3.6-flash` output, entirely correct Vietnamese prose)

> ...Sự hoài nghi trong mắt vị tướng vẫn chưa hề tan biến...

Flagged as `language_mixing` because the regex matched "i nghi trong m" — "i" (a fragment of
"hoài"), "nghi", "trong", and "m" (a fragment of "mắt") — four ASCII-looking tokens with no genuine
English content anywhere in the sentence.

## The fix

Rewritten to operate on whole whitespace-delimited words (punctuation stripped) instead of
sub-word regex matches — a word containing any Vietnamese diacritic can never be counted as an
"ASCII word," so it can never be silently fragmented into one. Three regression tests added,
including this exact real repro text.

## Impact on this task's evidence

This bug affected **only Vietnamese verdicts** (the check is a no-op for English) and was present
for `gemini-3.6-flash`'s first bakeoff pass and part of the second. Structural pass/repair numbers
for `gemini-3.6-flash` VI cases from those two passes are **not** reported as reliable evidence in
COMPARISON.md — only the corrected, post-fix behavior is used going forward (demonstrated on
`gemini-3.5-flash-lite`'s fully clean 12/12 run, and on the one post-fix `gemini-3.6-flash` sample
this task could still obtain before its daily quota was exhausted).
