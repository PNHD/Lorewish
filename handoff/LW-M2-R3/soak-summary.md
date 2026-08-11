# DeepSeek Flash Soak Summary

Authoritative campaign: 6 synthetic Golden Set cases × 8 independent runs, JSON object mode, Flash primary and one Flash repair maximum.

| Metric | Result |
|---|---:|
| Initial generations | 48 |
| Initial pass | 47 (97.9167%) |
| Schema-valid rate | 97.9167% |
| Quality-gate pass rate | 97.9167% |
| Repair required | 1 (2.0833%) |
| Repair success | 1/1 |
| Final pass | 48/48 |
| Final failure | 0 (0%) |
| Provider HTTP errors | 0 |
| Timeouts | 0 |
| Cost | $0.009461 |
| Latency | min 3527 ms; median 5759 ms; p95 8739 ms; max 9348 ms |

By language: EN 24/24 initial and final; VI 23/24 initial, 24/24 final. By genre: Fantasy 15/16 initial, 16/16 final; Romance 16/16; Adventure 16/16.

The only initial failure was valid JSON with an invalid `canon_candidates[].fact_key`; exact ASCII snake_case repair guidance resolved it. Raw provider bodies were not retained.

