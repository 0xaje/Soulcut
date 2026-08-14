import { describe, expect, it } from "vitest";
import { buildJobPdfReport, orderReportEvents } from "./jobPdfReport";

describe("job PDF report", () => {
  it("creates a formatted PDF containing job results and an ordered recorded timeline", async () => {
    const pdf = await buildJobPdfReport(
      {
        id: "job-pdf-1",
        videoUrl: "https://video.example/watch",
        status: "done",
        createdAt: new Date("2026-08-14T03:00:00.000Z"),
        startedAt: new Date("2026-08-14T03:00:05.000Z"),
        completedAt: new Date("2026-08-14T03:01:00.000Z"),
        summary: "A focused brief for the video.",
        topics: ["strategy", "editing"],
        clips: [{ startSeconds: 4, endSeconds: 22, title: "The opening", hook: "A strong hook.", reason: "It frames the video." }],
        sourceNote: "Grounded in public context.",
        model: "gpt-5-mini",
        failureReason: null,
      },
      [
        { id: 2, stage: "complete", message: "Your video brief is ready.", createdAt: new Date("2026-08-14T03:01:00.000Z") },
        { id: 1, stage: "reading", message: "Reading accessible source context.", createdAt: new Date("2026-08-14T03:00:10.000Z") },
      ]
    );

    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
    const pdfText = pdf.toString("latin1");
    expect(pdfText).toContain("/Type /Catalog");
    expect(pdfText).toContain("SoulCut");
    expect(pdfText).toContain("/Count 2");
  });

  it("orders recorded stages by persistent event ID before rendering", () => {
    expect(orderReportEvents([{ id: 3 }, { id: 1 }, { id: 2 }]).map(event => event.id)).toEqual([1, 2, 3]);
  });

  it("optionally includes the bounded Creative DNA snapshot used by an authenticated analysis", async () => {
    const pdf = await buildJobPdfReport(
      {
        id: "job-pdf-mind",
        videoUrl: "https://video.example/mind",
        status: "done",
        createdAt: new Date("2026-08-14T03:00:00.000Z"),
        startedAt: null,
        completedAt: new Date("2026-08-14T03:01:00.000Z"),
        summary: "A focused brief.",
        topics: [],
        clips: [],
        sourceNote: null,
        model: "gpt-5-mini",
        failureReason: null,
      },
      [],
      undefined,
      { preferences: [{ category: "hook", value: "Question-first hooks", confidence: 84, evidenceCount: 3 }] }
    );

    const pdfText = Array.from(pdf.toString("latin1").matchAll(/<([0-9a-fA-F]+)>/g))
      .map(match => Buffer.from(match[1], "hex").toString("latin1"))
      .join("");
    expect(pdfText).toContain("CREATIVE DNA APPLIED");
    expect(pdfText).toContain("Question-first hooks");
    expect(pdfText).toContain("Mind insight:");
  });
});
