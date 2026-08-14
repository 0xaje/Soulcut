import { useAuth } from "@/_core/hooks/useAuth";
import { MindEvidenceDetails, type CreativeDnaMemory } from "@/components/MindEvidenceDetails";
import { groupMindActivityByRecency } from "@/lib/mindPresentation";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Brain, CircleDot, Network, Sparkles, ThumbsUp } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function CreativeDNA() {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const [selectedMemoryId, setSelectedMemoryId] = useState<number | null>(null);
  const [editingMemory, setEditingMemory] = useState<CreativeDnaMemory | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [retiringMemory, setRetiringMemory] = useState<CreativeDnaMemory | null>(null);
  const [retirementReason, setRetirementReason] = useState("");
  const mindQuery = trpc.mind.getMind.useQuery(undefined, { enabled: isAuthenticated });
  const creativeDnaQuery = trpc.mind.getCreativeDNA.useQuery({ includeRetired: true }, { enabled: isAuthenticated });
  const mindActivityQuery = trpc.mind.getMindActivity.useQuery({ limit: 24 }, { enabled: isAuthenticated });
  const evidenceInput = useMemo(() => ({ memoryId: selectedMemoryId ?? 1 }), [selectedMemoryId]);
  const preferenceEvidenceQuery = trpc.mind.getPreferenceEvidence.useQuery(evidenceInput, { enabled: isAuthenticated && selectedMemoryId !== null });
  const updatePreference = trpc.mind.updatePreference.useMutation();
  const retirePreference = trpc.mind.retirePreference.useMutation();
  const restorePreference = trpc.mind.restorePreference.useMutation();
  const activityGroups = useMemo(() => groupMindActivityByRecency(mindActivityQuery.data ?? []), [mindActivityQuery.data]);

  if (loading || !isAuthenticated) {
    return <main className="workspace-bg grid min-h-screen place-items-center px-6 text-sm text-white/55">Opening your private Creative DNA…</main>;
  }

  const stats = creativeDnaQuery.data?.stats;
  const refreshDna = async () => {
    await Promise.all([creativeDnaQuery.refetch(), mindActivityQuery.refetch()]);
  };
  const savePreference = async () => {
    if (!editingMemory || editingValue.trim().length < 3) return;
    try {
      const result = await updatePreference.mutateAsync({ memoryId: editingMemory.id, value: editingValue.trim() });
      setEditingMemory(null);
      setEditingValue("");
      await refreshDna();
      toast.success(result.message);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Preference could not be refined."); }
  };
  const retireSelectedPreference = async () => {
    if (!retiringMemory) return;
    try {
      const result = await retirePreference.mutateAsync({ memoryId: retiringMemory.id, reason: retirementReason.trim() || undefined });
      setRetiringMemory(null);
      setRetirementReason("");
      await refreshDna();
      toast.success(result.message);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Preference could not be retired."); }
  };
  const restoreSelectedPreference = async (memory: CreativeDnaMemory) => {
    try {
      const result = await restorePreference.mutateAsync({ memoryId: memory.id });
      await refreshDna();
      toast.success(result.message);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Preference could not be restored."); }
  };
  return (
    <main className="workspace-bg min-h-screen text-white">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#08080b]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black"><Sparkles size={15} strokeWidth={2.7} /></span><span className="font-display text-lg tracking-[-0.04em]">SoulCut</span></Link>
          <Link href="/app" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/65 transition hover:border-[#c7ff4b]/45 hover:text-[#d8ff83]"><ArrowLeft size={14} /> Workspace</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#c7ff4b]/18 bg-[#10140f] p-6 sm:p-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#c7ff4b]/10 blur-3xl" aria-hidden="true" />
          <div className="relative max-w-3xl"><p className="eyebrow text-[#d8ff83]">Private Creative Intelligence</p><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="font-display text-5xl leading-[.86] tracking-[-.07em] sm:text-7xl">Your Creative <span className="italic text-white/42">DNA.</span></h1><span className="inline-flex items-center gap-1 rounded-full border border-[#c7ff4b]/20 bg-[#c7ff4b]/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-[#d8ff83]"><CircleDot size={10} /> {mindQuery.data?.builderAvailability === "available" ? "Minds connected" : "Learning"}</span></div><p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/55">SoulCut Creative Director keeps only evidence-backed preferences here. Direct teaching is explicit; repeated choices become behavioral patterns only after sufficient real feedback.</p></div>
          <div className="relative mt-8 grid gap-3 sm:grid-cols-4">{[["Preferences", stats?.preferenceCount ?? 0, Brain], ["Feedback signals", stats?.feedbackCount ?? 0, ThumbsUp], ["Strong patterns", stats?.strongPatterns ?? 0, Network], ["Avg. confidence", `${stats?.averageConfidence ?? 0}%`, CircleDot]].map(([label, value, Icon]) => { const StatIcon = Icon as typeof Brain; return <div key={label as string} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex items-center justify-between text-white/35"><span className="text-[10px] uppercase tracking-[.12em]">{label as string}</span><StatIcon size={14} /></div><p className="mt-3 font-display text-3xl tracking-[-.05em]">{value as string | number}</p></div>; })}</div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-3xl border border-white/9 bg-white/[.025] p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow text-[9px]">Evidence-backed preferences</p><h2 className="mt-2 font-display text-4xl tracking-[-.06em]">What your Mind knows.</h2></div><p className="max-w-xs text-xs leading-relaxed text-white/38">Refining preserves evidence. Retired preferences remain auditable but no longer guide new analysis.</p></div>{editingMemory && <div className="mt-5 rounded-2xl border border-[#c7ff4b]/20 bg-[#c7ff4b]/[.045] p-4"><p className="text-xs font-medium text-[#d8ff83]">Refine preference</p><textarea value={editingValue} onChange={event => setEditingValue(event.target.value)} maxLength={500} className="mt-3 min-h-20 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-[#c7ff4b]/45" /><div className="mt-3 flex gap-2"><button type="button" onClick={() => void savePreference()} disabled={updatePreference.isPending || editingValue.trim().length < 3} className="rounded-lg bg-[#e9ffe2] px-3 py-2 text-xs font-semibold text-[#111710] disabled:opacity-50">{updatePreference.isPending ? "Saving" : "Save refinement"}</button><button type="button" onClick={() => { setEditingMemory(null); setEditingValue(""); }} className="px-3 py-2 text-xs text-white/50 transition hover:text-white">Cancel</button></div></div>}{retiringMemory && <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[.05] p-4"><p className="text-xs font-medium text-red-100">Retire this preference?</p><p className="mt-1 text-xs leading-relaxed text-white/50">It will no longer influence future analysis. Its evidence remains in your private history.</p><input value={retirementReason} onChange={event => setRetirementReason(event.target.value)} maxLength={320} className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-red-300/45" placeholder="Optional reason" /><div className="mt-3 flex gap-2"><button type="button" onClick={() => void retireSelectedPreference()} disabled={retirePreference.isPending} className="rounded-lg border border-red-300/35 px-3 py-2 text-xs text-red-100 disabled:opacity-50">{retirePreference.isPending ? "Retiring" : "Retire preference"}</button><button type="button" onClick={() => { setRetiringMemory(null); setRetirementReason(""); }} className="px-3 py-2 text-xs text-white/50 transition hover:text-white">Cancel</button></div></div>}<div className="mt-6 grid gap-3 sm:grid-cols-2"><MindEvidenceDetails memories={creativeDnaQuery.data?.memories ?? []} selectedMemoryId={selectedMemoryId} onSelectMemory={setSelectedMemoryId} onCloseEvidence={() => setSelectedMemoryId(null)} evidence={preferenceEvidenceQuery.data} isLoadingEvidence={preferenceEvidenceQuery.isLoading} onEditMemory={memory => { setEditingMemory(memory); setEditingValue(memory.value); setRetiringMemory(null); }} onRetireMemory={memory => { setRetiringMemory(memory); setEditingMemory(null); }} onRestoreMemory={memory => void restoreSelectedPreference(memory)} /></div></section>
          <aside className="rounded-3xl border border-white/9 bg-[#101015] p-5 sm:p-6"><p className="eyebrow text-[9px]">Mind activity</p><h2 className="mt-2 font-display text-3xl tracking-[-.055em]">Learning over time.</h2><div className="mt-6 space-y-5">{activityGroups.length ? activityGroups.map(group => <section key={group.label}><p className="font-mono text-[10px] uppercase tracking-[.13em] text-[#d8ff83]">{group.label}</p><div className="mt-2 space-y-2">{group.activity.map(item => <article key={item.id} className="rounded-xl border border-white/8 bg-white/[.025] p-3"><p className="text-xs leading-relaxed text-white/75">{item.message}</p><p className="mt-1 text-[10px] text-white/33">{item.activityType.replace(/_/g, " ")} · {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p></article>)}</div></section>) : <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs leading-relaxed text-white/38">Your Mind activity will appear after you teach it or respond to a recommendation.</p>}</div></aside>
        </div>
      </div>
    </main>
  );
}
