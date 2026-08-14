import { describe, expect, it } from "vitest";
import { buildCreativeMindAnalysisContext } from "./mindAnalysisContext";

describe("Creative Mind analysis context", () => {
  it("keeps only the six strongest supplied memories and bounds their values", () => {
    const context = buildCreativeMindAnalysisContext(Array.from({ length: 8 }, (_, index) => ({
      category: "hook",
      value: `Preference ${index} ${"x".repeat(220)}`,
      confidence: 150,
      evidenceCount: 0,
    })));

    expect(context?.preferences).toHaveLength(6);
    expect(context?.preferences[0]).toMatchObject({ confidence: 100, evidenceCount: 1 });
    expect(context?.preferences[0]?.value).toHaveLength(180);
  });

  it("returns no context when the Mind has no usable preference memories", () => {
    expect(buildCreativeMindAnalysisContext([])).toBeNull();
  });
});
