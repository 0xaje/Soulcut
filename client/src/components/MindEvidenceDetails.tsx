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
  confidenceEvolution?: {
    confidenceBefore: number | null;
    confidenceAfter: number | null;
    createdAt: Date | string;
  } | null;
  retiredAt?: Date | string | null;
  retirementReason?: string | null;
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
  onEditMemory,
  onRetireMemory,
  onRestoreMemory,
}: {
  memories: CreativeDnaMemory[];
  selectedMemoryId: number | null;
  onSelectMemory: (memoryId: number) => void;
  onCloseEvidence: () => void;
  evidence: CreativeDnaEvidence[] | undefined;
  isLoadingEvidence: boolean;
  onEditMemory?: (memory: CreativeDnaMemory) => void;
  onRetireMemory?: (memory: CreativeDnaMemory) => void;
  onRestoreMemory?: (memory: CreativeDnaMemory) => void;
}) {
  if (!memories.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm leading-relaxed text-slate-500 dark:border-white/12 dark:text-white/38">Teach your Mind a preference to begin building your Creative DNA.</div>;
  }

  return <>
    {memories.map(memory => <article key={memory.id} className={`rounded-2xl border p-3.5 shadow-sm dark:shadow-none transition ${memory.retiredAt ? "border-slate-200 bg-slate-100/70 opacity-70 dark:border-white/6 dark:bg-black/20" : "border-slate-200 bg-white dark:border-white/8 dark:bg-white/[.025]"}`}>
      <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[.12em] text-lime-700 dark:text-[#d8ff83]">{memory.category}</span><span className="font-mono text-[10px] text-slate-500 dark:text-white/38">{memory.retiredAt ? "Retired" : `${memory.confidence}%`}</span></div>
      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white/85">{memory.value}</p>
      <p className="mt-2 text-[10px] text-slate-500 dark:text-white/45">{describeMindEvidence(memory)}</p>
      {memory.confidenceEvolution && <p className="mt-1 text-[10px] text-lime-700 dark:text-[#d8ff83]/72">{memory.confidenceEvolution.confidenceBefore === null ? `Initial confidence ${memory.confidenceEvolution.confidenceAfter ?? memory.confidence}%` : memory.confidenceEvolution.confidenceAfter !== null && memory.confidenceEvolution.confidenceAfter > memory.confidenceEvolution.confidenceBefore ? `Confidence +${memory.confidenceEvolution.confidenceAfter - memory.confidenceEvolution.confidenceBefore} after latest signal` : "Confidence reconfirmed by latest signal"}</p>}
      {memory.retiredAt && <p className="mt-1 text-[10px] text-slate-500 dark:text-white/35">{memory.retirementReason ? `Reason: ${memory.retirementReason}` : "This preference no longer guides new analysis."}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><time className="text-[10px] text-slate-400 dark:text-white/30">{formatMindLastUpdated(memory.updatedAt)}</time><div className="flex items-center gap-2"><button type="button" onClick={() => onSelectMemory(memory.id)} className="text-[10px] font-semibold text-lime-700 hover:text-lime-800 dark:text-[#d8ff83] dark:hover:text-[#c7ff4b]">View evidence</button>{memory.retiredAt ? onRestoreMemory && <button type="button" onClick={() => onRestoreMemory(memory)} className="text-[10px] text-slate-600 hover:text-slate-900 dark:text-white/55 dark:hover:text-white">Restore</button> : <>{onEditMemory && <button type="button" onClick={() => onEditMemory(memory)} className="text-[10px] text-slate-600 hover:text-slate-900 dark:text-white/55 dark:hover:text-white">Edit</button>}{onRetireMemory && <button type="button" onClick={() => onRetireMemory(memory)} className="text-[10px] text-red-600 hover:text-red-700 dark:text-white/45 dark:hover:text-red-100">Retire</button>}</>}</div></div>
    </article>)}
    {selectedMemoryId !== null && <section className="sm:col-span-2 rounded-2xl border border-lime-300 bg-lime-50/90 p-4 dark:border-[#c7ff4b]/16 dark:bg-[#c7ff4b]/[.045]" aria-live="polite">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-lime-800 dark:text-[#d8ff83]">Evidence for this preference</p><button type="button" onClick={onCloseEvidence} className="text-[10px] text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white">Close</button></div>
      {isLoadingEvidence ? <p className="mt-3 text-xs text-slate-500 dark:text-white/42">Loading evidence…</p> : evidence?.length ? <ul className="mt-3 space-y-2">{evidence.map(item => <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/8 dark:bg-black/20 dark:shadow-none"><p className="text-xs leading-relaxed text-slate-800 dark:text-white/70">{item.detail}</p><p className="mt-1 text-[10px] text-slate-400 dark:text-white/35">{item.source} · weight {item.weight} · {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p></li>)}</ul> : <p className="mt-3 text-xs text-slate-500 dark:text-white/42">No evidence detail is available for this preference yet.</p>}
    </section>}
  </>;
}
