// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MindEvidenceDetails } from "../client/src/components/MindEvidenceDetails";

const memory = {
  id: 44,
  category: "hook",
  value: "Question-first hooks",
  confidence: 84,
  evidenceCount: 3,
  source: "explicit_creator_instruction",
  updatedAt: "2026-08-14T12:00:00.000Z",
  confidenceEvolution: { confidenceBefore: 76, confidenceAfter: 84, createdAt: "2026-08-14T12:00:00.000Z" },
};

describe("Creative DNA evidence interface", () => {
  it("shows transparent last-updated and evidence labels and selects a preference for inspection", async () => {
    const user = userEvent.setup();
    const onSelectMemory = vi.fn();
    render(<MindEvidenceDetails memories={[memory]} selectedMemoryId={null} onSelectMemory={onSelectMemory} onCloseEvidence={vi.fn()} evidence={undefined} isLoadingEvidence={false} />);

    expect(screen.getByText("3 evidence signals · explicit creator instruction")).toBeTruthy();
    expect(screen.getByText("Confidence +8 after latest signal")).toBeTruthy();
    expect(screen.getByText(/^Updated Aug 14$/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "View evidence" }));
    expect(onSelectMemory).toHaveBeenCalledWith(44);
  });

  it("renders evidence loading, empty, and actual evidence details for the selected preference", () => {
    const props = { memories: [memory], selectedMemoryId: 44, onSelectMemory: vi.fn(), onCloseEvidence: vi.fn() };
    const { rerender } = render(<MindEvidenceDetails {...props} evidence={undefined} isLoadingEvidence />);
    expect(screen.getByText("Loading evidence…")).toBeTruthy();

    rerender(<MindEvidenceDetails {...props} evidence={[]} isLoadingEvidence={false} />);
    expect(screen.getByText("No evidence detail is available for this preference yet.")).toBeTruthy();

    rerender(<MindEvidenceDetails {...props} evidence={[{ id: 2, detail: "Creator selected a question-led opening.", source: "onboarding", weight: 3, createdAt: "2026-08-14T12:00:00.000Z" }]} isLoadingEvidence={false} />);
    expect(screen.getByText("Creator selected a question-led opening.")).toBeTruthy();
    expect(screen.getByText(/onboarding · weight 3/)).toBeTruthy();
  });
});
