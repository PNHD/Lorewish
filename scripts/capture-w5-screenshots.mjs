// One-off screenshot pack generator for handoff/LW-W5-R1 (Part 24/25).
// Uses Playwright directly (not the test runner) against the static web
// export, with the same deterministic route-mocking pattern as
// tests/e2e/roleplay-chat.spec.ts — no real network/provider calls.
import { chromium, devices } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const OUT_DIR = "handoff/LW-W5-R1/screenshots";
const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;
mkdirSync(OUT_DIR, { recursive: true });

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const CHARACTER_ID = "33333333-3333-4333-8333-333333333333";
const THREAD_ID = "44444444-4444-4444-8444-444444444444";
const SUPABASE_PROJECT_REF = new URL(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://sfarcofvqfeobtcizxyv.supabase.co",
).hostname.split(".")[0];

const opening = {
  id: "55555555-5555-4555-8555-555555555555", run_branch_id: BRANCH_ID, seq_in_branch: 0,
  boundary_kind: "none", narrative: "Rain moves softly over the archive roof.\n\nMira waits beside the locked stacks, giving the silence room to mean something.",
  dialogue: [{ speaker: "Mira", line: "You came back for the truth, not the key." }],
  state_change_summary: [], next_choices: [], structured_outcome: {},
};
const current = {
  id: "66666666-6666-4666-8666-666666666666", run_branch_id: BRANCH_ID, seq_in_branch: 1,
  boundary_kind: "checkpoint", narrative: "The hidden stair opens beneath your hand.\n\nBelow, a warm light traces names that no living archivist remembers.",
  dialogue: [{ speaker: "Mira", line: "If we descend, we carry what we learn." }],
  state_change_summary: ["The hidden stair is open"],
  next_choices: [{ id: "descend", label: "Descend with Mira" }, { id: "wait", label: "Ask what she fears" }],
  structured_outcome: {},
};

async function installSignedInMocks(page) {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: "synthetic-screenshot-access-token",
      refresh_token: "synthetic-screenshot-refresh-token",
      token_type: "bearer",
      expires_in: 999999999,
      expires_at: 4102444800,
      user: { id: "77777777-7777-4777-8777-777777777777", aud: "authenticated", role: "authenticated", email: "screenshots@example.invalid", is_anonymous: false },
    }));
  }, `sb-${SUPABASE_PROJECT_REF}-auth-token`);

  await page.route("**/rest/v1/rpc/lw_get_run_state", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      run_branch_id: BRANCH_ID, branch_seq: 1, status: "EXPLICIT_CHECKPOINT", scene: current,
      scenes: [opening, current], story_title: "The Archive Below", story_premise: "Every promise leaves a room behind.",
      content_language: "vi",
      characters: [{ id: CHARACTER_ID, name: "Mira", role: "Archive keeper", relationship: "A wary ally", description: "She remembers the cost of every sealed door.", origin: "authored" }],
    }) });
  });

  const chatMessages = [{
    id: "88888888-8888-4888-8888-888888888888", role: "character", content: "Tôi vẫn nhớ nơi bạn đã giấu chiếc chìa khóa.",
    generation_status: null, error_class: null,
    memory_candidates: [{ memory_type: "player_fact", fact_key: "player_hid_key", fact_text: "Bạn đã giấu chiếc chìa khóa dưới bậc đá.", salience: 5, promoted: true }],
    created_at: "2026-08-11T00:00:00Z",
  }];
  await page.route("**/functions/v1/character-chat", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      thread: { id: THREAD_ID, player_run_id: RUN_ID, run_branch_id: BRANCH_ID, character_id: CHARACTER_ID },
      character: { id: CHARACTER_ID, name: "Mira", role: "Archive keeper", description: "She remembers the cost of every sealed door.", storyRelationship: "A wary ally", aliases: [] },
      content_language: "vi", messages: chatMessages,
    }) });
  });

  await page.route("**/functions/v1/submit-turn", async (route) => {
    // HTTP 200 with an ALLOWANCE_EXHAUSTED status body — submitTurn() only
    // throws on a non-2xx response; this is the actual success-shaped
    // contract for the allowance-exhausted play state (src/lib/story-engine.ts).
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ALLOWANCE_EXHAUSTED", reset_at: "2026-08-13T00:00:00Z" }) });
  });
}

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: false });
  console.log("captured", name);
}

const server = spawn(process.execPath, ["scripts/serve-web-export.mjs"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "inherit",
});
await delay(500);

const browser = await chromium.launch();
try {
  // ---- Desktop (1280x800) ----
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  let page = await desktop.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForSelector("text=START A STORY");
  await shoot(page, "desktop-home");

  await page.goto(`${BASE_URL}/play/`);
  await page.getByRole("radio", { name: "Advanced Setup" }).click();
  await page.getByRole("radio", { name: "Tiếng Việt" }).nth(1).click();
  await page.getByRole("button", { name: "Vietnamese forms of address" }).click();
  await shoot(page, "desktop-advanced-setup");
  await page.close();

  page = await desktop.newPage();
  await installSignedInMocks(page);
  await page.goto(`${BASE_URL}/play/${RUN_ID}`);
  await page.waitForSelector("text=The Archive Below");
  await shoot(page, "desktop-story");
  await page.close();

  page = await desktop.newPage();
  await installSignedInMocks(page);
  await page.goto(`${BASE_URL}/play/${RUN_ID}/characters`);
  await page.getByRole("heading", { name: "Characters" }).waitFor();
  await shoot(page, "desktop-characters");
  await page.getByRole("button", { name: "Talk to character" }).click();
  await page.getByRole("heading", { name: "Mira" }).waitFor();
  await shoot(page, "desktop-character-chat");
  await page.close();

  await desktop.close();

  // ---- Mobile (Pixel 7) ----
  const mobile = await browser.newContext({ ...devices["Pixel 7"] });

  page = await mobile.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.waitForSelector("text=START A STORY");
  await shoot(page, "mobile-home");

  await page.goto(`${BASE_URL}/play/`);
  await page.getByRole("radio", { name: "Advanced Setup" }).click();
  await page.getByRole("radio", { name: "Tiếng Việt" }).nth(1).click();
  await page.getByRole("button", { name: "Vietnamese forms of address" }).click();
  await shoot(page, "mobile-advanced-setup-vi");
  await page.close();

  page = await mobile.newPage();
  await installSignedInMocks(page);
  await page.goto(`${BASE_URL}/play/${RUN_ID}`);
  await page.waitForSelector("text=The Archive Below");
  await shoot(page, "mobile-story");

  // Quota state: trigger a custom action, submit-turn mock returns 429 allowance_exhausted.
  await page.getByPlaceholder("Or write your own action…").fill("Descend into the dark stair.");
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForSelector("text=You've used today's free generations");
  await shoot(page, "mobile-allowance-exhausted");
  await page.close();

  page = await mobile.newPage();
  await installSignedInMocks(page);
  await page.goto(`${BASE_URL}/play/${RUN_ID}/characters`);
  await page.getByRole("button", { name: "Talk to character" }).click();
  await page.getByRole("heading", { name: "Mira" }).waitFor();
  await shoot(page, "mobile-character-chat");
  await page.close();

  await mobile.close();
} finally {
  await browser.close();
  server.kill();
}

console.log("Screenshot pack complete.");
