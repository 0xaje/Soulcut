import { describe, expect, it } from "vitest";
import { filterJobHistory, getVisibleHistorySelection } from "../client/src/lib/jobHistory";

describe("job history filter integration", () => {
  const jobs = [
    { id: "ready-1", status: "done" as const },
    { id: "failed-1", status: "failed" as const },
    { id: "working-1", status: "processing" as const },
  ];

  it("switches from a selected successful job to the first failed run when the failure filter is activated", () => {
    const successful = filterJobHistory(jobs, "done");
    const selectedSuccessfulId = getVisibleHistorySelection(jobs, "done", successful[0].id);
    const selectedFailedId = getVisibleHistorySelection(jobs, "failed", selectedSuccessfulId);

    expect(selectedSuccessfulId).toBe("ready-1");
    expect(selectedFailedId).toBe("failed-1");
  });

  it("preserves a visible selection and clears it when no job matches a filter", () => {
    expect(getVisibleHistorySelection(jobs, "all", "failed-1")).toBe("failed-1");
    expect(getVisibleHistorySelection([{ id: "ready-1", status: "done" as const }], "failed", "ready-1")).toBeNull();
  });
});
