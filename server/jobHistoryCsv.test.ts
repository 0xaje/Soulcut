import { describe, expect, it } from "vitest";
import { buildJobHistoryCsv } from "./jobHistoryCsv";

describe("job history CSV export", () => {
  it("exports one ordered row per recorded stage with job details", () => {
    const csv = buildJobHistoryCsv(
      [{
        id: "job-1",
        videoUrl: "https://video.example/watch",
        status: "done",
        createdAt: new Date("2026-08-14T03:00:00.000Z"),
        startedAt: null,
        completedAt: new Date("2026-08-14T03:02:00.000Z"),
        summary: "A concise brief.",
        topics: ["strategy", "editing"],
        clips: [{ startSeconds: 4 }],
        model: "gpt-5-mini",
        failureReason: null,
      }],
      [
        { id: 2, jobId: "job-1", stage: "complete", message: "Ready.", createdAt: new Date("2026-08-14T03:02:00.000Z") },
        { id: 1, jobId: "job-1", stage: "reading", message: "Reading.", createdAt: new Date("2026-08-14T03:00:10.000Z") },
      ]
    );

    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('"job_id"');
    expect(lines[1]).toContain('"reading"');
    expect(lines[2]).toContain('"complete"');
    expect(lines[1]).toContain('"strategy | editing"');
  });

  it("quotes cells and prevents spreadsheet formula execution", () => {
    const csv = buildJobHistoryCsv(
      [{
        id: "job-2",
        videoUrl: "=HYPERLINK(\"https://malicious.example\")",
        status: "failed",
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        summary: "A \"quoted\" value",
        topics: [],
        clips: [],
        model: null,
        failureReason: null,
      }],
      []
    );

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"A ""quoted"" value"');
  });
});
