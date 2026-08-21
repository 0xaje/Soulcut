import { describe, expect, it } from "vitest";
import {
  formatSecondsToSmpte,
  formatSecondsToTimecode,
  generateCmx3600Edl,
  generateMarkdownScript,
  getVideoEmbedInfo,
  type ClipItem,
} from "../client/src/lib/exportUtils";


describe("exportUtils", () => {
  const sampleClips: ClipItem[] = [
    {
      startSeconds: 15,
      endSeconds: 45,
      title: "Viral Opening Hook",
      hook: "This changes everything about editing.",
      reason: "High viewer retention at the 15s mark.",
    },
    {
      startSeconds: 90,
      endSeconds: 150,
      title: "Core Technique Breakdown",
      hook: "Step two is what most creators miss.",
      reason: "Actionable payoff.",
    },
  ];

  it("formats seconds to readable HH:MM:SS timecode", () => {
    expect(formatSecondsToTimecode(0)).toBe("00:00:00");
    expect(formatSecondsToTimecode(75)).toBe("00:01:15");
    expect(formatSecondsToTimecode(3665)).toBe("01:01:05");
  });

  it("formats seconds to SMPTE timecode with fps", () => {
    expect(formatSecondsToSmpte(0, 30)).toBe("00:00:00:00");
    expect(formatSecondsToSmpte(15, 30)).toBe("00:00:15:00");
    expect(formatSecondsToSmpte(1.5, 30)).toBe("00:00:01:15");
  });

  it("generates a valid CMX 3600 EDL string", () => {
    const edl = generateCmx3600Edl(sampleClips, "TestProject", 30);
    expect(edl).toContain("TITLE: TestProject");
    expect(edl).toContain("FCM: NON-DROP FRAME");
    expect(edl).toContain("001  AX       V     C        00:00:15:00 00:00:45:00 00:00:00:00 00:00:30:00");
    expect(edl).toContain("* FROM CLIP NAME: Viral Opening Hook");
    expect(edl).toContain("002  AX       V     C        00:01:30:00 00:02:30:00 00:00:30:00 00:01:30:00");
  });

  it("generates structured markdown production script", () => {
    const md = generateMarkdownScript(sampleClips, "https://youtube.com/watch?v=123", "Video overview summary");
    expect(md).toContain("# SoulCut Production Script & Clip Breakdown");
    expect(md).toContain("https://youtube.com/watch?v=123");
    expect(md).toContain("### Clip 1: Viral Opening Hook");
    expect(md).toContain("Opening Hook:** \"This changes everything about editing.\"");
  });

  it("extracts embed URLs for YouTube, Vimeo, and direct media files", () => {
    const yt1 = getVideoEmbedInfo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(yt1.type).toBe("youtube");
    expect(yt1.videoId).toBe("dQw4w9WgXcQ");
    expect(yt1.embedUrl).toContain("embed/dQw4w9WgXcQ");

    const ytShort = getVideoEmbedInfo("https://youtube.com/shorts/abc123xyz");
    expect(ytShort.type).toBe("youtube");
    expect(ytShort.videoId).toBe("abc123xyz");

    const vimeo = getVideoEmbedInfo("https://vimeo.com/123456789");
    expect(vimeo.type).toBe("vimeo");
    expect(vimeo.videoId).toBe("123456789");

    const direct = getVideoEmbedInfo("https://cdn.example.com/videos/master.mp4");
    expect(direct.type).toBe("direct");
    expect(direct.embedUrl).toBe("https://cdn.example.com/videos/master.mp4");

    const unknown = getVideoEmbedInfo("not-a-valid-url");
    expect(unknown.type).toBe("unknown");
  });
});

