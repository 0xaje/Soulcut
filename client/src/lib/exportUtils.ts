export interface ClipItem {
  startSeconds: number;
  endSeconds: number;
  title: string;
  hook: string;
  reason: string;
}

export type VideoEmbedType = "youtube" | "vimeo" | "direct" | "unknown";

export interface VideoEmbedInfo {
  type: VideoEmbedType;
  embedUrl?: string;
  videoId?: string;
}

/**
 * Extracts embed URL and video metadata from supported video platforms
 */
export function getVideoEmbedInfo(url: string): VideoEmbedInfo {
  if (!url) return { type: "unknown" };
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
      let videoId = "";
      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.slice(1).split("/")[0];
      } else if (parsed.pathname.includes("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1].split("/")[0];
      } else if (parsed.pathname.includes("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1].split("/")[0];
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }
      if (videoId) {
        return {
          type: "youtube",
          videoId,
          embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0`,
        };
      }
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const match = parsed.pathname.match(/\/(\d+)/);
      if (match?.[1]) {
        return {
          type: "vimeo",
          videoId: match[1],
          embedUrl: `https://player.vimeo.com/video/${match[1]}`,
        };
      }
    }
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(parsed.pathname)) {
      return {
        type: "direct",
        embedUrl: url,
      };
    }
    return { type: "unknown" };
  } catch {
    return { type: "unknown" };
  }
}

/**
 * Formats seconds into HH:MM:SS format
 */
export function formatSecondsToTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats seconds into SMPTE timecode HH:MM:SS:FF at 30 fps
 */
export function formatSecondsToSmpte(seconds: number, fps = 30): string {
  const totalFrames = Math.max(0, Math.round(seconds * fps));
  const hrs = Math.floor(totalFrames / (3600 * fps));
  const mins = Math.floor((totalFrames % (3600 * fps)) / (60 * fps));
  const secs = Math.floor((totalFrames % (60 * fps)) / fps);
  const frames = totalFrames % fps;

  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

/**
 * Generates standard CMX 3600 EDL format for import into Adobe Premiere Pro, DaVinci Resolve, and Final Cut Pro
 */
export function generateCmx3600Edl(clips: ClipItem[], title = "SoulCut_Clips", fps = 30): string {
  const header = `TITLE: ${title.replace(/[^\w\s-]/g, "_")}\nFCM: NON-DROP FRAME\n\n`;
  let recordOffsetSeconds = 0;

  const events = clips.map((clip, index) => {
    const eventNum = (index + 1).toString().padStart(3, "0");
    const clipDuration = Math.max(1, clip.endSeconds - clip.startSeconds);

    const sourceIn = formatSecondsToSmpte(clip.startSeconds, fps);
    const sourceOut = formatSecondsToSmpte(clip.endSeconds, fps);
    const recordIn = formatSecondsToSmpte(recordOffsetSeconds, fps);
    const recordOut = formatSecondsToSmpte(recordOffsetSeconds + clipDuration, fps);

    recordOffsetSeconds += clipDuration;

    return `${eventNum}  AX       V     C        ${sourceIn} ${sourceOut} ${recordIn} ${recordOut}\n* FROM CLIP NAME: ${clip.title.replace(/\n/g, " ")}\n* COMMENT: HOOK: ${clip.hook.replace(/\n/g, " ")}\n`;
  });

  return header + events.join("\n");
}

/**
 * Generates a clean Markdown Creator Script for social media planning
 */
export function generateMarkdownScript(clips: ClipItem[], videoUrl: string, summary: string): string {
  const lines = [
    `# SoulCut Production Script & Clip Breakdown`,
    `**Source Video:** ${videoUrl}`,
    `**Overview:** ${summary}`,
    ``,
    `---`,
    `## Recommended Clips`,
    ``,
  ];

  clips.forEach((clip, index) => {
    lines.push(`### Clip ${index + 1}: ${clip.title}`);
    lines.push(`- **Timestamp:** \`${formatSecondsToTimecode(clip.startSeconds)}\` to \`${formatSecondsToTimecode(clip.endSeconds)}\` (${Math.round(clip.endSeconds - clip.startSeconds)}s)`);
    lines.push(`- **Opening Hook:** "${clip.hook}"`);
    lines.push(`- **Why it works:** ${clip.reason}`);
    lines.push(``);
  });

  return lines.join("\n");
}

/**
 * Generates an FCPXML document for Final Cut Pro and DaVinci Resolve
 */
export function generateFcpxml(clips: ClipItem[], title = "SoulCut_Clips", fps = 30): string {
  const safeTitle = (title || "SoulCut Clips").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const frameDuration = `100/${fps * 100}s`;

  let totalFrames = 0;
  const spineClips = clips.map((clip, index) => {
    const startFrames = Math.round(clip.startSeconds * fps);
    const durationFrames = Math.max(1, Math.round((clip.endSeconds - clip.startSeconds) * fps));
    const offsetFrames = totalFrames;
    totalFrames += durationFrames;

    const clipName = (clip.title || `Clip ${index + 1}`).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const hookNote = clip.hook ? clip.hook.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

    return `        <clip name="${clipName}" offset="${offsetFrames * 100}/${fps * 100}s" duration="${durationFrames * 100}/${fps * 100}s" start="${startFrames * 100}/${fps * 100}s">
          <note>${hookNote}</note>
        </clip>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080p${fps}" frameDuration="${frameDuration}" width="1920" height="1080"/>
  </resources>
  <library>
    <event name="${safeTitle}">
      <project name="${safeTitle}">
        <sequence format="r1" duration="${totalFrames * 100}/${fps * 100}s">
          <spine>
${spineClips}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
}

/**
 * Generates CapCut timeline JSON
 */
export function generateCapCutJson(clips: ClipItem[], videoUrl: string, title = "SoulCut Project"): string {
  return JSON.stringify(
    {
      app: "SoulCut AI Creative Director",
      version: "1.0",
      project: {
        title,
        sourceVideoUrl: videoUrl,
        aspectRatio: "9:16",
        targetResolution: { width: 1080, height: 1920 },
      },
      segments: clips.map((clip, index) => ({
        id: `clip_${index + 1}`,
        title: clip.title,
        inPointSeconds: clip.startSeconds,
        outPointSeconds: clip.endSeconds,
        durationSeconds: Math.round((clip.endSeconds - clip.startSeconds) * 100) / 100,
        hookText: clip.hook || "",
        viralityReason: clip.reason || "",
        tags: ["Shorts", "TikTok", "Reels"],
      })),
    },
    null,
    2
  );
}

/**
 * Generates SRT subtitle file
 */
export function generateSrt(clips: ClipItem[]): string {
  const formatSrtTime = (seconds: number) => {
    const s = Math.max(0, seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
  };

  return clips
    .map((clip, index) => {
      const idx = index + 1;
      const start = formatSrtTime(clip.startSeconds);
      const end = formatSrtTime(clip.endSeconds);
      const text = [clip.title, clip.hook ? `"${clip.hook}"` : ""].filter(Boolean).join("\n");
      return `${idx}\n${start} --> ${end}\n${text}\n`;
    })
    .join("\n");
}

/**
 * Triggers a client-side file download
 */
export function downloadFile(filename: string, content: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
