export type MindMemoryPresentation = {
  evidenceCount: number;
  source: string;
  updatedAt: Date | string;
};

export function describeMindEvidence(memory: Pick<MindMemoryPresentation, "evidenceCount" | "source">) {
  const noun = memory.evidenceCount === 1 ? "signal" : "signals";
  return `${memory.evidenceCount} evidence ${noun} · ${memory.source.replaceAll("_", " ")}`;
}

export function formatMindLastUpdated(updatedAt: MindMemoryPresentation["updatedAt"]) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "Updated date unavailable";
  return `Updated ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
