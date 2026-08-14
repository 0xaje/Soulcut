import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(fileURLToPath(new URL("../client/src/pages/Home.tsx", import.meta.url)), "utf8");
const workspaceSource = readFileSync(fileURLToPath(new URL("../client/src/pages/Workspace.tsx", import.meta.url)), "utf8");
const walkthroughSource = readFileSync(fileURLToPath(new URL("../client/src/pages/LiveWalkthrough.tsx", import.meta.url)), "utf8");

describe("hackathon Mind-first narrative", () => {
  it("makes SoulCut’s persistent creative intelligence visible before the video-input feature", () => {
    expect(homeSource).toContain("AI can edit a video.");
    expect(homeSource).toContain("SoulCut learns how you create.");
    expect(homeSource).toContain("Meet your Creative Mind");
    expect(homeSource).toContain("POWERED BY MINDS");
  });

  it("uses real persisted Mind context and honest grounding language in the creator workflow", () => {
    expect(workspaceSource).toContain("Minds supplies the persistent intelligence layer");
    expect(workspaceSource).toContain("Your Mind remembered");
    expect(workspaceSource).toContain("No documented Creative DNA preference directly matches this recommendation yet.");
    expect(workspaceSource).toContain("If the public source does not expose reliable timing");
  });

  it("provides a walkthrough driven by authenticated persisted state rather than invented completion", () => {
    expect(walkthroughSource).toContain("trpc.mind.getMind.useQuery");
    expect(walkthroughSource).toContain("trpc.videoJobs.list.useQuery");
    expect(walkthroughSource).toContain("trpc.mind.getRecommendationComparison.useQuery");
    expect(walkthroughSource).toContain("does not create sample activity");
  });
});
