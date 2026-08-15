import { useAuth } from "@/_core/hooks/useAuth";
import { MindEvidenceDetails, type CreativeDnaMemory } from "@/components/MindEvidenceDetails";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    return <main className="workspace-bg grid min-h-screen place-items-center px-6 text-sm text-slate-500 dark:text-white/55">Opening your private Creative DNA…</main>;
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
    <main className="workspace-bg min-h-screen text-slate-900 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-white/8 dark:bg-[#08080b]/85 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm dark:bg-white dark:text-black">
              <Sparkles size={15} strokeWidth={2.7} />
            </span>
            <span className="font-display text-lg tracking-[-0.04em]">SoulCut</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link href="/app" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-white/10 dark:bg-white/[.04] dark:text-white/65 dark:hover:border-[#c7ff4b]/45 dark:hover:text-[#d8ff83]">
              <ArrowLeft size={14} /> Workspace
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-300/80 bg-slate-100/90 p-6 shadow-sm dark:border-white/10 dark:bg-[#111116] sm:p-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl dark:bg-purple-500/[.07]" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <p className="eyebrow text-slate-700 dark:text-white/60">Private Creative Intelligence</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl leading-[1.08] tracking-[-.04em] text-slate-900 sm:text-5xl dark:text-white">
                Your Creative <span className="italic text-slate-500 dark:text-white/42">DNA.</span>
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[.12em] text-slate-800 dark:border-white/12 dark:bg-white/[.06] dark:text-white/80">
                <CircleDot size={10} /> {mindQuery.data?.builderAvailability === "available" ? "Minds connected" : "Learning"}
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-white/55">
              SoulCut Creative Director keeps only evidence-backed preferences here. Direct teaching is explicit; repeated choices become behavioral patterns only after sufficient real feedback.
            </p>
          </div>
          <div className="relative mt-8 grid gap-3 sm:grid-cols-4">
            {[
              ["Preferences", stats?.preferenceCount ?? 0, Brain],
              ["Feedback signals", stats?.feedbackCount ?? 0, ThumbsUp],
              ["Strong patterns", stats?.strongPatterns ?? 0, Network],
              ["Avg. confidence", `${stats?.averageConfidence ?? 0}%`, CircleDot],
            ].map(([label, value, Icon]) => {
              const StatIcon = Icon as typeof Brain;
              return (
                <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/8 dark:bg-black/20 dark:shadow-none">
                  <div className="flex items-center justify-between text-slate-500 dark:text-white/35">
                    <span className="text-[10px] font-semibold uppercase tracking-[.12em]">{label as string}</span>
                    <StatIcon size={14} />
                  </div>
                  <p className="mt-3 font-display text-3xl tracking-[-.05em] text-slate-900 dark:text-white">{value as string | number}</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 dark:border-white/9 dark:bg-white/[.025] dark:shadow-none">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow text-[9px] text-lime-700 dark:text-[#d8ff83]">Evidence-backed preferences</p>
                <h2 className="mt-2 font-display text-4xl tracking-[-.06em] text-slate-900 dark:text-white">What your Mind knows.</h2>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-white/38">Refining preserves evidence. Retired preferences remain auditable but no longer guide new analysis.</p>
            </div>
            {editingMemory && (
              <div className="mt-5 rounded-2xl border border-slate-300 bg-slate-100/90 p-4 dark:border-white/10 dark:bg-[#111116]">
                <p className="text-xs font-semibold text-slate-800 dark:text-white/80">Refine preference</p>
                <textarea value={editingValue} onChange={event => setEditingValue(event.target.value)} maxLength={500} className="mt-3 min-h-20 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-white/40" />
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void savePreference()} disabled={updatePreference.isPending || editingValue.trim().length < 3} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">{updatePreference.isPending ? "Saving" : "Save refinement"}</button>
                  <button type="button" onClick={() => { setEditingMemory(null); setEditingValue(""); }} className="px-3 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-white/50 dark:hover:text-white">Cancel</button>
                </div>
              </div>
            )}
            {retiringMemory && (
              <div className="mt-5 rounded-2xl border border-red-300 bg-red-50/80 p-4 dark:border-red-300/20 dark:bg-red-300/[.05]">
                <p className="text-xs font-semibold text-red-900 dark:text-red-100">Retire this preference?</p>
                <p className="mt-1 text-xs leading-relaxed text-red-700 dark:text-white/50">It will no longer influence future analysis. Its evidence remains in your private history.</p>
                <input value={retirementReason} onChange={event => setRetirementReason(event.target.value)} maxLength={320} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-red-300/45" placeholder="Optional reason" />
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void retireSelectedPreference()} disabled={retirePreference.isPending} className="rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-900 disabled:opacity-50 dark:border-red-300/35 dark:bg-transparent dark:text-red-100">{retirePreference.isPending ? "Retiring" : "Retire preference"}</button>
                  <button type="button" onClick={() => { setRetiringMemory(null); setRetirementReason(""); }} className="px-3 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-white/50 dark:hover:text-white">Cancel</button>
                </div>
              </div>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <MindEvidenceDetails
                memories={creativeDnaQuery.data?.memories ?? []}
                selectedMemoryId={selectedMemoryId}
                onSelectMemory={setSelectedMemoryId}
                onCloseEvidence={() => setSelectedMemoryId(null)}
                evidence={preferenceEvidenceQuery.data}
                isLoadingEvidence={preferenceEvidenceQuery.isLoading}
                onEditMemory={memory => { setEditingMemory(memory); setEditingValue(memory.value); setRetiringMemory(null); }}
                onRetireMemory={memory => { setRetiringMemory(memory); setEditingMemory(null); }}
                onRestoreMemory={memory => void restoreSelectedPreference(memory)}
              />
            </div>
          </section>
          <aside className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 dark:border-white/9 dark:bg-[#101015]">
            <p className="eyebrow text-[9px] text-lime-700 dark:text-[#d8ff83]">Mind activity</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-.055em] text-slate-900 dark:text-white">Learning over time.</h2>
            <div className="mt-6 space-y-5">
              {activityGroups.length ? activityGroups.map(group => (
                <section key={group.label}>
                  <p className="font-mono text-[10px] uppercase tracking-[.13em] text-lime-700 dark:text-[#d8ff83]">{group.label}</p>
                  <div className="mt-2 space-y-2">
                    {group.activity.map(item => (
                      <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/8 dark:bg-white/[.025] dark:shadow-none">
                        <p className="text-xs leading-relaxed text-slate-800 dark:text-white/75">{item.message}</p>
                        <p className="mt-1 text-[10px] text-slate-400 dark:text-white/33">{item.activityType.replace(/_/g, " ")} · {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )) : (
                <p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs leading-relaxed text-slate-500 dark:border-white/10 dark:text-white/38">Your Mind activity will appear after you teach it or respond to a recommendation.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
