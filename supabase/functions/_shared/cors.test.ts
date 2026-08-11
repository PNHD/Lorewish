import { describe, expect, it } from "vitest";

import { corsHeaders, isAllowedLorewishOrigin } from "./cors.ts";

describe("Lorewish Edge Function CORS", () => {
  it("allows production, Pages previews, and local DEV", () => {
    expect(isAllowedLorewishOrigin("https://lorewish.pages.dev")).toBe(true);
    expect(isAllowedLorewishOrigin("https://a1b2c3.lorewish.pages.dev")).toBe(true);
    expect(isAllowedLorewishOrigin("http://localhost:8081")).toBe(true);
    expect(isAllowedLorewishOrigin("http://127.0.0.1:3000")).toBe(true);
  });

  it("never reflects an untrusted origin", () => {
    expect(isAllowedLorewishOrigin("https://evil.example")).toBe(false);
    expect(corsHeaders("https://evil.example")["Access-Control-Allow-Origin"])
      .toBe("https://lorewish.pages.dev");
  });
});
