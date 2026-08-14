import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(
  fileURLToPath(new URL("../client/src/pages/Workspace.tsx", import.meta.url)),
  "utf8"
);
const styleSource = readFileSync(
  fileURLToPath(new URL("../client/src/index.css", import.meta.url)),
  "utf8"
);

describe("AI analysis loading animation", () => {
  it("exposes an announced processing state with staged feedback", () => {
    expect(workspaceSource).toContain("function AnalysisLoadingCard({");
    expect(workspaceSource).toContain("useAnalysisProgress(processingJobId)");
    expect(workspaceSource).toContain("progress={progress.latestEvent}");
    expect(workspaceSource).toContain('role="status"');
    expect(workspaceSource).toContain('aria-live="polite"');
    expect(workspaceSource).toContain("Reading source");
    expect(workspaceSource).toContain("Finding signal");
    expect(workspaceSource).toContain("Shaping clips");
  });

  it("includes a reduced-motion fallback for the processing animation", () => {
    expect(styleSource).toContain(".analysis-loader");
    expect(styleSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styleSource).toContain("animation: none !important");
  });

  it("includes a reopenable completed-job timeline in the workspace", () => {
    expect(workspaceSource).toContain("function CompletedJobTimeline");
    expect(workspaceSource).toContain("trpc.videoJobs.timeline.useQuery");
    expect(workspaceSource).toContain("View stage timeline");
  });
});
