import { describe, expect, it } from "vitest";
import { describeMindEvidence, formatMindActivityGroup, formatMindLastUpdated, groupMindActivityByRecency } from "../client/src/lib/mindPresentation";

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

  it("groups persisted activity by truthful relative dates", () => {
    const now = new Date("2026-08-14T15:00:00.000Z");
    expect(formatMindActivityGroup("2026-08-14T08:00:00.000Z", now)).toBe("Today");
    expect(formatMindActivityGroup("2026-08-13T08:00:00.000Z", now)).toBe("Yesterday");
    expect(formatMindActivityGroup("2026-08-11T08:00:00.000Z", now)).toBe("3 days ago");
    expect(groupMindActivityByRecency([
      { id: 1, createdAt: "2026-08-14T08:00:00.000Z" },
      { id: 2, createdAt: "2026-08-13T08:00:00.000Z" },
      { id: 3, createdAt: "2026-08-14T09:00:00.000Z" },
    ], now)).toEqual([
      { label: "Today", activity: [{ id: 1, createdAt: "2026-08-14T08:00:00.000Z" }, { id: 3, createdAt: "2026-08-14T09:00:00.000Z" }] },
      { label: "Yesterday", activity: [{ id: 2, createdAt: "2026-08-13T08:00:00.000Z" }] },
    ]);
  });
});
