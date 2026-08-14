# Lorewish

**Enter a world that remembers you.**

Lorewish is an experimental solo interactive-story and roleplay product. It sits between static branching fiction and unstructured character chat: players enter a world, make choices, talk to characters, and carry durable story/character memory across sessions.

## Product focus

- Solo interactive storytelling with fast setup.
- Narrative and adventure-oriented play rather than a heavy tabletop rules simulator.
- Durable world, relationship, and character memory.
- Branch-aware character chat tied to story state.
- English and Vietnamese product surfaces.
- Continuous-play behavior: provider errors or generation boundaries should not silently end a story.

The product definition and constraints are documented in [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md), [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md), and [`docs/CONTINUOUS_PLAY_CONTRACT.md`](docs/CONTINUOUS_PLAY_CONTRACT.md).

## Stack

- Expo / React Native / React Native Web
- TypeScript
- Supabase
- Vitest
- Playwright

## Validation

The repository uses automated checks for both implementation and product regressions:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run export:web
npm run test:e2e
```

Recent work includes browser-level regression coverage, responsive/accessibility checks, server-backed memory persistence, ownership-bound chat access, and deterministic model-evaluation fixtures.

## Repository structure

- `src/` — application UI and client logic
- `supabase/` — database migrations and edge functions
- `tests/` — unit and end-to-end coverage
- `docs/` — product, domain, architecture, quality, and roadmap contracts
- `scripts/` — validation and model-evaluation tooling

## Development status

Lorewish is under active development. Internal milestone and verification artifacts in this repository are working evidence, not claims that every planned feature is production-complete.
