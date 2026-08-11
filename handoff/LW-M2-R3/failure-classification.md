# Failure Classification

## R2 retained evidence

R2 retained aggregate/final artifacts, not every initial provider payload. Exact facts recoverable are: 12 Flash initial generations, 4 repair events, 11 final passes, and one final `malformed_choices` failure. The other three R2 initial repair causes cannot be reconstructed honestly from retained artifacts.

The pre-fix dominant defect was separately observed: default DeepSeek thinking consumed the 2048-token budget and left empty content. Thinking remains disabled.

## R3 forensic campaigns

- Strict-tool prototype: schema-conformity failures remained despite `strict: true`.
- Pre-hardening 48 strict-tool run: 7 repairs; five `valid_json_wrong_shape` failures were invalid `fact_key` values, plus one repetition quality failure and one VI language failure; two final failures.
- Post-structure hardening strict-tool run: 45/48 initial, 3 repairs, 48/48 final. Initial classes: one wrong shape, one language failure, one invalid JSON.
- First JSON-object policy run: 44/48 initial, four repairs, 47/48 final. The final failure was VI `language_mixing` on both initial and repair.
- Final policy run after actionable language-repair guidance: 47/48 initial, one `valid_json_wrong_shape`, 48/48 final.

No failure was treated as generic “AI randomness.” Semantic omissions and malformed fields still fail/repair; no field is invented or silently rewritten.

