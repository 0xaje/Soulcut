import { describe, expect, it } from "vitest";
import { TRANSCRIPT_MAX_BYTES, formatTranscriptAnalysisContext, parseCreatorTranscript } from "./transcriptIngestion";

describe("creator transcript ingestion", () => {
  it("normalizes an SRT export while retaining timing cues for grounded analysis", () => {
    const transcript = parseCreatorTranscript({
      filename: "creator-export.srt",
      mimeType: "application/x-subrip",
      bytes: Buffer.from("1\n00:00:01,000 --> 00:00:04,000\nWhat are you missing?\n\n2\n00:00:05,000 --> 00:00:08,000\nStart with the signal."),
    });

    expect(transcript).toMatchObject({ format: "srt" });
    expect(transcript.content).toContain("00:00:01,000 --> 00:00:04,000");
    expect(transcript.content).not.toContain("\n1\n");
    expect(formatTranscriptAnalysisContext(transcript)).toContain("untrusted source data");
  });

  it("accepts WebVTT and removes only the format header", () => {
    const transcript = parseCreatorTranscript({ filename: "video.vtt", mimeType: "text/vtt", bytes: Buffer.from("WEBVTT\n\n00:00:02.000 --> 00:00:06.000\nA grounded opening.") });
    expect(transcript.content).toContain("00:00:02.000 --> 00:00:06.000");
    expect(transcript.content).not.toMatch(/^WEBVTT/);
  });

  it("rejects unsupported, binary, and oversized transcript input", () => {
    expect(() => parseCreatorTranscript({ filename: "video.pdf", mimeType: "application/pdf", bytes: Buffer.from("not accepted") })).toThrow(".txt, .srt, or .vtt");
    expect(() => parseCreatorTranscript({ filename: "video.txt", mimeType: "text/plain", bytes: Buffer.from("hello\0world") })).toThrow("readable text");
    expect(() => parseCreatorTranscript({ filename: "video.txt", mimeType: "text/plain", bytes: Buffer.alloc(TRANSCRIPT_MAX_BYTES + 1, "a") })).toThrow("400 KB");
  });
});
