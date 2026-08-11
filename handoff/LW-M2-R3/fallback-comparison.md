# Flash vs Pro Repair Comparison

Policy A is Flash initial → one Flash repair. Policy B is Flash initial → one Pro repair. No third call or recursive fallback exists.

On the strict-tool continuity comparison, Policy A recorded four repair calls and three final generation failures across the 8-sequence campaign. Policy B recorded six repair calls and the same three final generation failures, cost $0.022966, median provider-call latency 12189 ms, and p95 21839 ms. Pro itself produced invalid JSON and repeated quality failures.

Policy B therefore did not materially improve reliability and was rejected. The selected policy is Flash-only with JSON object mode and one Flash repair. Its final campaign cost was $0.009461 and its final continuity campaign cost was $0.009039.

