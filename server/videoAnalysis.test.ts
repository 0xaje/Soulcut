import { describe, expect, it } from "vitest";
import { isPublicVideoUrl, parseVideoAnalysis } from "./videoAnalysis";

describe("video analysis validation", () => {
  it("accepts public video URLs and rejects localhost or private network URLs", () => {
    expect(isPublicVideoUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isPublicVideoUrl("http://127.0.0.1:3000/private.mp4")).toBe(false);
    expect(isPublicVideoUrl("http://192.168.1.9/camera.mp4")).toBe(false);
    expect(isPublicVideoUrl("ftp://video.example.com/source.mp4")).toBe(false);
  });

  it("parses a complete analysis payload and rejects invalid clip timing", () => {
    expect(
      parseVideoAnalysis(
        JSON.stringify({
          summary: "A concise explanation of the video.",
          topics: ["creative strategy", "short-form video"],
          clips: [
            {
              startSeconds: 12,
              endSeconds: 28,
              title: "The opening idea",
              hook: "The first sentence makes the case.",
              reason: "It frames the whole discussion quickly.",
            },
          ],
          sourceNote: "Grounded in publicly available source material.",
        })
      )
    ).toMatchObject({ topics: ["creative strategy", "short-form video"] });

    expect(() =>
      parseVideoAnalysis(
        JSON.stringify({
          summary: "Invalid timing.",
          topics: [],
          clips: [{ startSeconds: 28, endSeconds: 12, title: "Bad", hook: "Bad timing", reason: "Bad timing" }],
          sourceNote: "Test.",
        })
      )
    ).toThrow();
  });
});
