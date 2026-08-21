import { describe, expect, it } from "vitest";
import {
  buildCapCutJsonExport,
  buildEdlExport,
  buildFcpxmlExport,
  buildSrtExport,
  secondsToSrtTimestamp,
  secondsToTimecode,
} from "./timelineExport";

describe("Timeline Export Engine", () => {
  const sampleClips = [
    {
      title: "The Opening Hook",
      startSeconds: 15,
      endSeconds: 45,
      hook: "Did you know 90% of creators quit in month 1?",
      reason: "High tension opening question",
    },
    {
      title: "The Core Insight",
      startSeconds: 120.5,
      endSeconds: 180,
      hook: "Here is the exact formula.",
      reason: "Actionable payoff",
    },
  ];

  describe("timecode formatters", () => {
    it("converts seconds to standard SMPTE timecode (HH:MM:SS:FF)", () => {
      expect(secondsToTimecode(0)).toBe("00:00:00:00");
      expect(secondsToTimecode(65.5, 30)).toBe("00:01:05:15");
      expect(secondsToTimecode(3661, 30)).toBe("01:01:01:00");
    });

    it("converts seconds to SRT timestamp (HH:MM:SS,mmm)", () => {
      expect(secondsToSrtTimestamp(0)).toBe("00:00:00,000");
      expect(secondsToSrtTimestamp(65.5)).toBe("00:01:05,500");
    });
  });

  describe("buildEdlExport", () => {
    it("generates valid CMX 3600 EDL formatted text", () => {
      const edl = buildEdlExport("My Podcast Distillation", sampleClips);
      expect(edl).toContain("TITLE: MY PODCAST DISTILLATION");
      expect(edl).toContain("FCM: NON-DROP FRAME");
      expect(edl).toContain("001  AX       V     C        00:00:15:00 00:00:45:00 00:00:00:00 00:00:30:00");
      expect(edl).toContain("* FROM CLIP NAME: The Opening Hook");
      expect(edl).toContain("* COMMENT: Hook: Did you know 90% of creators quit in month 1?");
    });
  });

  describe("buildFcpxmlExport", () => {
    it("generates valid FCPXML with sequence and spine clips", () => {
      const xml = buildFcpxmlExport("Viral Clips", sampleClips);
      expect(xml).toContain("<!DOCTYPE fcpxml>");
      expect(xml).toContain('<clip name="The Opening Hook"');
      expect(xml).toContain("<note>Did you know 90% of creators quit in month 1?</note>");
      expect(xml).toContain("</fcpxml>");
    });
  });

  describe("buildCapCutJsonExport", () => {
    it("generates structured CapCut project JSON", () => {
      const jsonStr = buildCapCutJsonExport("Test Project", "https://youtube.com/watch?v=123", sampleClips);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.app).toBe("SoulCut AI Creative Director");
      expect(parsed.project.aspectRatio).toBe("9:16");
      expect(parsed.segments).toHaveLength(2);
      expect(parsed.segments[0].durationSeconds).toBe(30);
    });
  });

  describe("buildSrtExport", () => {
    it("generates standard timed SRT subtitles for hooks", () => {
      const srt = buildSrtExport(sampleClips);
      expect(srt).toContain("1\n00:00:15,000 --> 00:00:45,000\nThe Opening Hook\n\"Did you know 90% of creators quit in month 1?\"");
      expect(srt).toContain("2\n00:02:00,500 --> 00:03:00,000");
    });
  });
});
