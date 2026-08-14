import { describe, expect, it } from "vitest";
import { filterJobHistory } from "../client/src/lib/jobHistory";

describe("job history filters", () => {
  const jobs = [
    { id: "complete", status: "done" as const },
    { id: "failed", status: "failed" as const },
    { id: "working", status: "processing" as const },
  ];

  it("shows all jobs without excluding in-progress work", () => {
    expect(filterJobHistory(jobs, "all").map(job => job.id)).toEqual(["complete", "failed", "working"]);
  });

  it("separates successful and failed runs", () => {
    expect(filterJobHistory(jobs, "done").map(job => job.id)).toEqual(["complete"]);
    expect(filterJobHistory(jobs, "failed").map(job => job.id)).toEqual(["failed"]);
  });
});
