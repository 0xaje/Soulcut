import { describe, expect, it } from "vitest";
import { describeMindEvidence, formatMindLastUpdated } from "../client/src/lib/mindPresentation";

describe("Creative DNA presentation", () => {
  it("makes evidence source and singular or plural count transparent", () => {
    expect(describeMindEvidence({ evidenceCount: 1, source: "explicit_creator_instruction" }))
      .toBe("1 evidence signal · explicit creator instruction");
    expect(describeMindEvidence({ evidenceCount: 3, source: "feedback" }))
      .toBe("3 evidence signals · feedback");
  });

  it("formats a valid last-updated timestamp and handles invalid values honestly", () => {
    expect(formatMindLastUpdated("2026-08-14T12:00:00.000Z")).toMatch(/^Updated Aug 14$/);
    expect(formatMindLastUpdated("invalid")).toBe("Updated date unavailable");
  });
});
