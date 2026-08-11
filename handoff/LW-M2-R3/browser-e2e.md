# Browser E2E — Revised Owner Scope

## Completed

- Final live deployment: `https://35d2e67b.lorewish.pages.dev` through Pages project `lorewish`; canonical domain `https://lorewish.pages.dev`.
- `/preview`: public, deterministic sample scene rendered.
- `/play` signed out: rendered sign-in requirement; no anonymous generation UI.
- Direct unauthenticated Edge invocation: HTTP 401 before application/provider execution.

Final browser console review of both `/preview` and signed-out `/play` found zero errors and zero warnings. An earlier account-form accessibility issue is deferred with the auth UX and does not expose inference or block the verified public shell.

## Superseded requirements

The owner explicitly superseded the manually authenticated real-provider browser E2E. No owner login, manual allowlisting, adult declaration, social login, or public anonymous inference is required or permitted for LW-M2-R3.

`PUBLIC_REAL_AI_BROWSER_E2E_DEFERRED`: real DeepSeek correctness is evidenced at the server/engine boundary by the 48-generation soak, 24-turn continuity soak, Edge Function deployment/probes, atomic canonical commit tests, failure/no-partial-Scene tests, one-repair tests, branch-isolation tests, and cost accounting.

`USER_AUTH_UX_DEFERRED` and `SOCIAL_AUTH_DEFERRED`: future product work should be guest-first and must design abuse/rate-limit/account-linking/privacy UX before enabling any public real inference.
