# Browser E2E evidence

Matrix: desktop Chromium plus Pixel 7 emulation.

Covered paths:

- public Quick Start/Advanced Setup and EN/VI UI baseline
- `/play/[runId]` full Story reader and branch label
- choices, custom-action composer, loading/duplicate-submit guard, replay affordance
- long paste, wrapping, no horizontal overflow, and mobile density
- `/play/[runId]/characters` canonical Character directory
- `/play/[runId]/characters/[characterId]` separate Chat surface
- English UI with Vietnamese Story/Chat content
- explicit promotion affordance
- durable send and reload history
- zero captured console warnings/errors

The browser suite intercepts Supabase/Edge network calls with deterministic synthetic responses. It never claims a real-provider browser pass. Real inference stays protected by the current authenticated alpha boundary.

Production smoke separately navigated Home and all three dynamic roleplay routes on `https://lorewish.pages.dev`, confirmed HTTP 200 with URL preservation, and observed no Chromium console/page errors.
