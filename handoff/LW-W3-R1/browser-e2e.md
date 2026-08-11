# Browser E2E and Live QA

## Automated

Command: `npm run test:e2e`

Projects: Desktop Chrome and Pixel 7. Result: 4 passed.

Coverage:

- public Quick Start default
- public Advanced Setup disclosure and input
- story-language switch and all four Vietnamese address presets
- draft persistence across reload
- manual UI-language EN/VI switch
- signed-out boundary remains `Sign in to start`
- no horizontal overflow

## Live production

URL: `https://lorewish.pages.dev/play/`

DevTools result after final deploy:

- production document 200
- JS asset `entry-96deb6f110c675ea43f1889cf819c768.js` 200
- favicon 304
- no console warnings/errors/issues
- horizontal overflow 0
- Advanced draft persisted premise, player name, character name, and aliases after reload

Screenshots are in `screenshots/desktop-quick-en.png` and `screenshots/mobile-advanced-vi.png`.
