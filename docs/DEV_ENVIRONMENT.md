# Dev Environment — Supabase (`lorewish-dev`)

Status: LW-M1-R2. Records configuration for the dev Supabase project that is **not**
represented as a SQL migration — either because it is Auth/dashboard-only configuration, or
because it is a deliberate, documented decision about what this task did *not* automate.

## Project identity

- Name: `lorewish-dev`
- Project ref: `sfarcofvqfeobtcizxyv`
- Project URL: `https://sfarcofvqfeobtcizxyv.supabase.co`
- Region: `ap-southeast-1`
- Organization: `dbodjqmarksspvyknnlv`
- This is a **dev-only** project. Never connect Lorewish application code to `doodle-world-studio`
  (a different project in the same organization) or to any other project in this organization.

## Auth — Site URL and Redirect URLs (manual dashboard step, not automated)

`supabase/config.toml`'s `[auth]` section is **not** pushed to this project via
`supabase config push` in this task. `config push` overwrites the *entire* remote project
configuration (API, DB, Auth, Storage settings — not just the `[auth]` block) with whatever is in
the local `config.toml`, which is CLI-scaffold-default content this task did not fully audit
against the project's actual current settings. Given the live project already existed before this
task and its current full configuration was not independently verified field-by-field, pushing the
scaffold file risked silently changing settings unrelated to what this task needed (e.g.
`enable_confirmations = false` in the scaffolded `[auth.email]` block — the *local dev* CLI
default — would have **turned off email confirmation on the live dev project**, which directly
contradicts this task's instruction to preserve the secure default). Documenting the two fields
that actually need to be set, for the project owner to apply once in the dashboard, is the safer
path.

**Required values** (Supabase dashboard → this project → Authentication → URL Configuration):

| Field | Value |
|---|---|
| Site URL | `https://lorewish.pages.dev` |
| Additional Redirect URLs | `https://lorewish.pages.dev/account`, `http://localhost:8081/account`, `http://localhost:3000/account` |

The three redirect URLs cover: the live deployment's account route (email-confirmation links land
here), the `expo start --web` dev server (port 8081, per `.claude/launch.json`'s `lorewish-dev`
profile), and the static-export local preview server (port 3000, the `lorewish-web` profile).

**Email confirmation**: left at whatever the project's own default already is (Supabase's current
project-creation default is confirmations **on**). No change was made by this task. Verified
indirectly: a real sign-up attempt against this project's Auth API during LW-M1-R2 testing
returned `429 over_email_send_rate_limit` on a syntactically valid signup — meaning a confirmation
email send was actually attempted, which would not happen if confirmations were off. If a future
task needs confirmations off for a specific, scoped dev-testing reason, that decision must be made
and recorded explicitly here, not defaulted into silently by pushing a scaffold config file.

## Auth — providers

Email/password only. Do not enable Google/Apple/Facebook/Discord/other OAuth providers, and do not
enable anonymous sign-ins (`enable_anonymous_sign_ins`) — both are explicitly out of scope for
LW-M1-R2 (see `CURRENT_WORK.md` — Guest Behavior).

## Data API keys

Client code uses the **publishable key** (`sb_publishable_...`), read from
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`). The service-role/secret key is never
used in application code — only from ephemeral local tooling (e.g. one-off adversarial RLS test
scripts run from a developer machine to create/delete disposable test accounts), and is never
written to a tracked file.

## Local Supabase CLI

`supabase/config.toml` exists for local project identity (`supabase init` output) and is committed.
`supabase link --project-ref sfarcofvqfeobtcizxyv` links a working copy to this project; re-run it
after a fresh clone. No local Supabase stack (`supabase start`, Docker) was used for this task —
Docker Desktop was not running in this environment, so migrations were authored as SQL files and
applied directly to the linked remote dev project with `supabase db push`, then verified with
`supabase migration list` and `supabase db advisors --linked`.
