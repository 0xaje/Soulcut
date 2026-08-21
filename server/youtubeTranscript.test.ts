import { describe, expect, it } from "vitest";
import {
  extractYouTubeVideoId,
  formatSecondsToTimestamp,
  parseYouTubeXmlCaptions,
} from "./transcriptIngestion";

describe("YouTube Transcript Ingestion", () => {
  describe("extractYouTubeVideoId", () => {
    it("extracts ID from standard watch URLs", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractYouTubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from short youtu.be URLs", () => {
      expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from YouTube Shorts and Embed URLs", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("returns null for invalid or non-YouTube URLs", () => {
      expect(extractYouTubeVideoId("https://vimeo.com/123456")).toBeNull();
      expect(extractYouTubeVideoId("not-a-url")).toBeNull();
    });
  });

  describe("formatSecondsToTimestamp", () => {
    it("formats seconds into MM:SS correctly", () => {
      expect(formatSecondsToTimestamp(0)).toBe("00:00");
      expect(formatSecondsToTimestamp(65)).toBe("01:05");
      expect(formatSecondsToTimestamp(3600)).toBe("60:00");
    });
  });

  describe("parseYouTubeXmlCaptions", () => {
    it("parses and decodes XML caption tags with timing cues", () => {
      const sampleXml = `
        <transcript>
          <text start="0.5" dur="3.2">Welcome to &amp;#39;SoulCut&amp;#39;!</text>
          <text start="4.1" dur="2.8">&lt;b&gt;AI-Native&lt;/b&gt; Creative Director &amp;amp; editor.</text>
        </transcript>
      `;

      const result = parseYouTubeXmlCaptions(sampleXml);
      expect(result).toContain("[00:00] Welcome to 'SoulCut'!");
      expect(result).toContain("[00:04] AI-Native Creative Director & editor.");
    });
  });
});
