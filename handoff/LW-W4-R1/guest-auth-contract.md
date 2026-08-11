# Guest auth contract — LW-W4-R1

## Mechanism

- Anonymous auth is enabled on Supabase DEV (`sfarcofvqfeobtcizxyv`); `config.toml` sets `enable_anonymous_sign_ins = true`.
- The client never signs in eagerly. `src/auth/guest-session.ts` performs lazy `supabase.auth.signInAnonymously()` only when the user takes a first generating action (Begin Story / first message).
- Anonymous users receive a normal Supabase JWT with `role: authenticated` and `is_anonymous: true` in the payload. RLS and RPC ownership checks use `auth.uid()`, which resolves for anonymous sessions exactly as it does for permanent accounts.
- `public.profiles` accepts null email/identity metadata for anonymous users; the row is created by the existing on-signup trigger with only `id` + locale (see migration comment in `20260811093214_lw_w4_guest_beta_safety.sql`).

## Live verification (this session)

Ran `scripts/w4-live-dev-probe.ts` against DEV twice (see `security-results.txt`):

```
W4_LIVE_GUEST_ISOLATION_PASS
anonymousSessions: 2
profileNullPii: true
crossGuestStoryRead: false
crossGuestStoryWrite: false
crossGuestChildAttach: false
noJwtStatus: 401
invalidJwtStatus: 401
serviceTelemetryClientAccess: false
```

This independently proves, against live DEV, not local code:
- Two anonymous sessions can be created concurrently, each with a null-PII profile.
- Guest B cannot read, update, or attach child records to Guest A's Story (RLS ownership holds both directions).
- `submit-turn` rejects a request with no `Authorization` header (401), before any provider call.
- `character-chat` rejects a request with an invalid JWT (401), before any provider call.
- An anonymous user cannot call the service-only provider-budget summary RPC or read the alpha admin table.

## Real browser confirmation

Also exercised through the actual UI against DEV (not mocks): "Begin Story" with no prior session created a Guest lazily, produced a real `player_run_id`/URL, and the same Guest session then supported Character Chat, branching, and reload without re-authentication. See `real-browser-e2e.md`.

## Known non-blocker

`TURNSTILE_RECOMMENDED_BEFORE_BROAD_PROMOTION` — no bot-protection gate exists in front of anonymous sign-in yet. Not required for `OWNER_AND_LINK_SHARED_BETA` scope; flagged for before any broad/public promotion.
