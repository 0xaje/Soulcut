import React from "react";
import { describeMindEvidence, formatMindLastUpdated } from "@/lib/mindPresentation";

export type CreativeDnaMemory = {
  id: number;
  category: string;
  value: string;
  confidence: number;
  evidenceCount: number;
  source: string;
  updatedAt: Date | string;
};

export type CreativeDnaEvidence = {
  id: number;
  detail: string;
  source: string;
  weight: number;
  createdAt: Date | string;
};

export function MindEvidenceDetails({
  memories,
  selectedMemoryId,
  onSelectMemory,
  onCloseEvidence,
  evidence,
  isLoadingEvidence,
}: {
  memories: CreativeDnaMemory[];
  selectedMemoryId: number | null;
  onSelectMemory: (memoryId: number) => void;
  onCloseEvidence: () => void;
  evidence: CreativeDnaEvidence[] | undefined;
  isLoadingEvidence: boolean;
}) {
  if (!memories.length) {
    return <div className="rounded-2xl border border-dashed border-white/12 p-4 text-sm leading-relaxed text-white/38">Teach your Mind a preference to begin building your Creative DNA.</div>;
  }

  return <>
    {memories.map(memory => <article key={memory.id} className="rounded-2xl border border-white/8 bg-white/[.025] p-3.5">
      <div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-[.12em] text-[#d8ff83]">{memory.category}</span><span className="font-mono text-[10px] text-white/38">{memory.confidence}%</span></div>
      <p className="mt-2 text-sm text-white/80">{memory.value}</p>
      <p className="mt-2 text-[10px] text-white/37">{describeMindEvidence(memory)}</p>
      <div className="mt-3 flex items-center justify-between gap-2"><time className="text-[10px] text-white/30">{formatMindLastUpdated(memory.updatedAt)}</time><button type="button" onClick={() => onSelectMemory(memory.id)} className="text-[10px] text-[#d8ff83] transition hover:text-[#c7ff4b]">View evidence</button></div>
    </article>)}
    {selectedMemoryId !== null && <section className="sm:col-span-2 rounded-2xl border border-[#c7ff4b]/16 bg-[#c7ff4b]/[.045] p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-[#d8ff83]">Evidence for this preference</p><button type="button" onClick={onCloseEvidence} className="text-[10px] text-white/45 transition hover:text-white">Close</button></div>
      {isLoadingEvidence ? <p className="mt-3 text-xs text-white/42">Loading evidence…</p> : evidence?.length ? <ul className="mt-3 space-y-2">{evidence.map(item => <li key={item.id} className="rounded-xl border border-white/8 bg-black/20 p-3"><p className="text-xs leading-relaxed text-white/70">{item.detail}</p><p className="mt-1 text-[10px] text-white/35">{item.source} · weight {item.weight} · {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p></li>)}</ul> : <p className="mt-3 text-xs text-white/42">No evidence detail is available for this preference yet.</p>}
    </section>}
  </>;
}
