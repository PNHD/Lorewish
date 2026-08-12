# LW-W5-R1 — Production Smoke

**Status: not performed. Deferred pending explicit user go-ahead.**

The task spec gates production deploy on all local CI being green (it is — see `ci-results.txt`,
`test-results.txt`) and requires a small bounded real-provider smoke test (max 8 additional real
attempts) immediately after deploying. Per this session's safety policy, an actual deploy to the live
production Cloudflare environment (`lorewish.pages.dev`) is an irreversible, shared-state action that
requires the user's explicit go-ahead beyond what the task document alone authorizes — the user was
asked directly and chose to hold off for now (see the session transcript around the draft-PR
checkpoint).

Technical readiness, for when the user gives the go-ahead:

- `gh` CLi is authenticated as the repo owner (`PNHD`) with `repo`/`workflow` scopes.
- `wrangler` is authenticated with `pages:write` against the Cloudflare account tied to this
  project's production Pages deployment.
- Draft PR is open: https://github.com/PNHD/Lorewish/pull/7
- Local CI is fully green on the exact branch head that would be deployed (see `git-log.txt` for the
  commit list, `ci-results.txt`/`test-results.txt` for results).

When authorized, the remaining steps are: confirm the exact-head CI is still green, deploy
`feature/lw-w5-product-ux` to the actual Cloudflare Pages production environment (not a preview
branch deployment), confirm via the Cloudflare deployment dashboard, then run the bounded real smoke
pass (Home → Guest Start → real Story opening → one continuation → Character Chat → reload →
replay/path → one EN and one VI register check), staying within the 8-real-attempt budget, and record
the results in this file.
