import { expect, test, type Page } from "@playwright/test";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";
const CHARACTER_ID = "33333333-3333-4333-8333-333333333333";
const THREAD_ID = "44444444-4444-4444-8444-444444444444";

type MockChatMessage = {
  id: string;
  role: "player" | "character";
  content: string;
  generation_status: "pending" | "completed" | "failed" | null;
  error_class: "provider_error" | "validation_error" | "transport_error" | null;
  memory_candidates: { memory_type: string; fact_key: string; fact_text: string; salience: number }[];
  created_at: string;
};

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

async function installSignedInMocks(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("sb-sfarcofvqfeobtcizxyv-auth-token", JSON.stringify({
      access_token: "synthetic-e2e-access-token",
      refresh_token: "synthetic-e2e-refresh-token",
      token_type: "bearer",
      expires_in: 999999999,
      expires_at: 4102444800,
      user: { id: "77777777-7777-4777-8777-777777777777", aud: "authenticated", role: "authenticated", email: "e2e@example.invalid", is_anonymous: false },
    }));
  });

  await page.route("**/rest/v1/rpc/lw_get_run_state", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      run_branch_id: BRANCH_ID, branch_seq: 1, status: "EXPLICIT_CHECKPOINT", scene: current,
      scenes: [opening, current], story_title: "The Archive Below", story_premise: "Every promise leaves a room behind.",
      content_language: "vi",
      characters: [{ id: CHARACTER_ID, name: "Mira", role: "Archive keeper", relationship: "A wary ally", description: "She remembers the cost of every sealed door.", origin: "authored" }],
    }) });
  });

  let chatMessages: MockChatMessage[] = [{
    id: "88888888-8888-4888-8888-888888888888", role: "character", content: "Tôi vẫn nhớ nơi bạn đã giấu chiếc chìa khóa.",
    generation_status: null, error_class: null, memory_candidates: [{ memory_type: "player_fact", fact_key: "player_hid_key", fact_text: "Bạn đã giấu chiếc chìa khóa dưới bậc đá.", salience: 5 }], created_at: "2026-08-11T00:00:00Z",
  }];
  await page.route("**/functions/v1/character-chat", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as Record<string, unknown>;
    if (body.action === "send") {
      await new Promise((resolve) => setTimeout(resolve, 180));
      chatMessages = [...chatMessages,
        { id: body.message_id as string, role: "player", content: body.content as string, generation_status: "completed", error_class: null, memory_candidates: [], created_at: "2026-08-11T00:01:00Z" },
        { id: "99999999-9999-4999-8999-999999999999", role: "character", content: "Ta nghe thấy. Nhưng lời thú nhận này vẫn chỉ ở giữa chúng ta.", generation_status: null, error_class: null, memory_candidates: [], created_at: "2026-08-11T00:01:01Z" },
      ];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      thread: { id: THREAD_ID, player_run_id: RUN_ID, run_branch_id: BRANCH_ID, character_id: CHARACTER_ID },
      character: { id: CHARACTER_ID, name: "Mira", role: "Archive keeper", description: "She remembers the cost of every sealed door.", storyRelationship: "A wary ally", aliases: [] },
      content_language: "vi", messages: chatMessages,
    }) });
  });

  await page.route("**/functions/v1/submit-turn", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "CONTINUE_READY", turn_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scene: { ...current, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", seq_in_branch: 2, boundary_kind: "none", narrative: "The archive answers without closing the path.", next_choices: [] } }) });
  });
  await page.route("**/functions/v1/replay-branch", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ run_branch_id: BRANCH_ID, scene: current }) });
  });
  await page.route("**/rest/v1/rpc/lw_promote_chat_memory", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }) });
  });
}

test.beforeEach(async ({ page }) => {
  await installSignedInMocks(page);
});

test("Story reader remains editorial, long-session safe, and duplicate-submit resistant", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") consoleErrors.push(message.text()); });
  let submits = 0;
  page.on("request", (request) => { if (request.url().includes("/functions/v1/submit-turn")) submits += 1; });
  await page.goto(`/play/${RUN_ID}`);
  await expect(page.getByRole("heading", { name: "The Archive Below" })).toBeVisible();
  await expect(page.getByText("Rain moves softly over the archive roof.")).toBeVisible();
  await expect(page.getByText("The hidden stair opens beneath your hand.")).toBeVisible();
  await expect(page.getByText("Alternate path", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Characters/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay from here" })).toBeVisible();
  await page.getByRole("heading", { name: "The Archive Below" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("story.png"), fullPage: false });

  const composer = page.getByPlaceholder("Or write your own action…");
  await composer.fill("A very long deliberate action. ".repeat(80));
  await expect(composer).toHaveJSProperty("scrollWidth", await composer.evaluate((element) => element.clientWidth));
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: "Send" }).click({ force: true }).catch(() => undefined);
  await expect.poll(() => submits).toBe(1);
  await expect(page.getByText("The archive answers without closing the path.")).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);
});

test("Character directory and branch-bound Chat persist across reload", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") consoleErrors.push(message.text()); });
  await page.goto(`/play/${RUN_ID}/characters`);
  await expect(page.getByRole("heading", { name: "Characters" })).toBeVisible();
  await page.getByRole("button", { name: "Talk to character" }).click();
  await expect(page.getByRole("heading", { name: "Mira" })).toBeVisible();
  await expect(page.getByText("This conversation is private to this story path.", { exact: false })).toBeVisible();
  await expect(page.getByText("Tôi vẫn nhớ nơi bạn đã giấu chiếc chìa khóa.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remember in story" })).toBeVisible();

  const composer = page.getByPlaceholder("Write to this character…");
  await composer.fill("Tôi đã đánh tráo chiếc chìa khóa.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Ta nghe thấy. Nhưng lời thú nhận này vẫn chỉ ở giữa chúng ta.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ta nghe thấy. Nhưng lời thú nhận này vẫn chỉ ở giữa chúng ta.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("character-chat.png"), fullPage: true });
});
