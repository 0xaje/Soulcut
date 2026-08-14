import { listMindMemoriesForUser } from "./db";

export type CreativeMindAnalysisContext = {
  preferences: Array<{
    category: string;
    value: string;
    confidence: number;
    evidenceCount: number;
  }>;
};

export function buildCreativeMindAnalysisContext(memories: Array<{
  category: string;
  value: string;
  confidence: number;
  evidenceCount: number;
}>): CreativeMindAnalysisContext | null {
  const preferences = memories
    .filter(memory => memory.value.trim().length > 0)
    .slice(0, 6)
    .map(memory => ({
      category: memory.category,
      value: memory.value.trim().slice(0, 180),
      confidence: Math.max(1, Math.min(100, memory.confidence)),
      evidenceCount: Math.max(1, memory.evidenceCount),
    }));
  return preferences.length ? { preferences } : null;
}

export async function getCreativeMindAnalysisContextForUser(userId: number) {
  return buildCreativeMindAnalysisContext(await listMindMemoriesForUser(userId));
}
