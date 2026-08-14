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

export function formatMindActivityGroup(value: Date | string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const activityDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.max(0, Math.round((today.getTime() - activityDay.getTime()) / 86_400_000));
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function groupMindActivityByRecency<T extends { createdAt: Date | string }>(items: T[], now = new Date()) {
  const groups = new Map<string, T[]>();
  items.forEach(item => {
    const label = formatMindActivityGroup(item.createdAt, now);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  });
  return Array.from(groups.entries()).map(([label, activity]) => ({ label, activity }));
}
