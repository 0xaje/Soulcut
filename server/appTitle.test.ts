import { describe, expect, it } from "vitest";

describe("application title configuration", () => {
  it("uses SoulCut as the managed application title", () => {
    expect(process.env.VITE_APP_TITLE).toBe("SoulCut");
  });
});
