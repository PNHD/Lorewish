import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const en = JSON.parse(readFileSync("src/i18n/locales/en.json", "utf8"));
const vi = JSON.parse(readFileSync("src/i18n/locales/vi.json", "utf8"));

describe("guest beta EN/VI product copy", () => {
  it.each([en, vi])("separates personal Story, Chat, global capacity, network, and safety states", (catalogue) => {
    expect(catalogue.play.allowanceExhaustedHeading).toBeTruthy();
    expect(catalogue.chat.allowanceExhausted).toBeTruthy();
    expect(catalogue.play.betaCapacityHeading).toBeTruthy();
    expect(catalogue.play.networkErrorHeading).toBeTruthy();
    expect(catalogue.play.safetyRejectedHeading).toBeTruthy();
  });

  it.each([en, vi])("explains browser-bound Guest persistence without auth jargon", (catalogue) => {
    expect(catalogue.setup.guestPersistenceNote).toBeTruthy();
    expect(catalogue.account.guestSession).toBeTruthy();
  });
});
