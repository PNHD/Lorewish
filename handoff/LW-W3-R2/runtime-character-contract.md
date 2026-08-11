# Runtime Character contract

- `authored` Characters remain setup-controlled and post-start immutable.
- `runtime` Characters can be created only by the service-only canonical Story commit RPC.
- The provider can propose at most three bounded candidates with a server-ignored temporary key, name, role, description, relationship, and aliases.
- The model never chooses the database UUID.
- Candidate schema/moderation/identity validation occurs before commit.
- Exact normalized name or alias collision rejects the generation; no fuzzy merge is attempted.
- Scene and runtime Characters commit in the same transaction. Any validation/commit failure leaves neither persisted.
- Provenance records source Scene, creating Turn, and introduced Branch.
- A runtime Character becomes Chat-eligible only after its canonical commit and only on branches where its introducing Scene is visible.
- Its canonical UUID enters provider context on the next turn; same-turn Character-memory temporary-ID resolution is intentionally unsupported.
