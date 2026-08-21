export interface TimelineClip {
  title: string;
  startSeconds: number;
  endSeconds: number;
  hook?: string | null;
  reason?: string | null;
}

export function secondsToTimecode(totalSeconds: number, fps: number = 30): string {
  const roundedSecs = Math.max(0, totalSeconds);
  const hours = Math.floor(roundedSecs / 3600);
  const minutes = Math.floor((roundedSecs % 3600) / 60);
  const seconds = Math.floor(roundedSecs % 60);
  const frames = Math.floor((roundedSecs % 1) * fps);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const ff = String(frames).padStart(2, "0");

  return `${hh}:${mm}:${ss}:${ff}`;
}

export function secondsToSrtTimestamp(totalSeconds: number): string {
  const roundedSecs = Math.max(0, totalSeconds);
  const hours = Math.floor(roundedSecs / 3600);
  const minutes = Math.floor((roundedSecs % 3600) / 60);
  const seconds = Math.floor(roundedSecs % 60);
  const ms = Math.floor((roundedSecs % 1) * 1000);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(ms).padStart(3, "0");

  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * Builds a CMX 3600 Edit Decision List (EDL) for Adobe Premiere Pro, DaVinci Resolve, and Avid.
 */
export function buildEdlExport(title: string, clips: TimelineClip[], fps: number = 30): string {
  const cleanTitle = (title || "SoulCut Timeline").slice(0, 40).toUpperCase().replace(/[^A-Z0-9 _-]/g, "");
  const lines: string[] = [
    `TITLE: ${cleanTitle}`,
    "FCM: NON-DROP FRAME",
    "",
  ];

  let recordStartSec = 0;

  clips.forEach((clip, index) => {
    const editNum = String(index + 1).padStart(3, "0");
    const sourceIn = secondsToTimecode(clip.startSeconds, fps);
    const sourceOut = secondsToTimecode(clip.endSeconds, fps);
    const duration = Math.max(0.1, clip.endSeconds - clip.startSeconds);
    const recordIn = secondsToTimecode(recordStartSec, fps);
    const recordOut = secondsToTimecode(recordStartSec + duration, fps);
    recordStartSec += duration;

    lines.push(`${editNum}  AX       V     C        ${sourceIn} ${sourceOut} ${recordIn} ${recordOut}`);
    lines.push(`* FROM CLIP NAME: ${clip.title.replace(/\r?\n/g, " ")}`);
    if (clip.hook) {
      lines.push(`* COMMENT: Hook: ${clip.hook.replace(/\r?\n/g, " ")}`);
    }
    lines.push("");
  });

  return lines.join("\r\n");
}

/**
 * Builds an FCPXML document compatible with Final Cut Pro, Premiere Pro, and DaVinci Resolve.
 */
export function buildFcpxmlExport(title: string, clips: TimelineClip[], fps: number = 30): string {
  const safeTitle = (title || "SoulCut Clips").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const frameDuration = `100/${fps * 100}s`;

  let totalFrames = 0;
  const spineClips = clips.map((clip, index) => {
    const startFrames = Math.round(clip.startSeconds * fps);
    const durationFrames = Math.max(1, Math.round((clip.endSeconds - clip.startSeconds) * fps));
    const offsetFrames = totalFrames;
    totalFrames += durationFrames;

    const clipName = (clip.title || `Clip ${index + 1}`).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const hookNote = clip.hook ? (clip.hook).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

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
 * Builds CapCut & Web NLE compatible JSON timeline with subtitle markers.
 */
export function buildCapCutJsonExport(title: string, videoUrl: string, clips: TimelineClip[]) {
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
 * Builds an SRT subtitle file containing hooks and captions for the clips.
 */
export function buildSrtExport(clips: TimelineClip[]): string {
  return clips
    .map((clip, index) => {
      const idx = index + 1;
      const start = secondsToSrtTimestamp(clip.startSeconds);
      const end = secondsToSrtTimestamp(clip.endSeconds);
      const text = [clip.title, clip.hook ? `"${clip.hook}"` : ""].filter(Boolean).join("\n");
      return `${idx}\n${start} --> ${end}\n${text}\n`;
    })
    .join("\n");
}
