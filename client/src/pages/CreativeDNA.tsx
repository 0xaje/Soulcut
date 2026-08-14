import { useAuth } from "@/_core/hooks/useAuth";
import { MindEvidenceDetails } from "@/components/MindEvidenceDetails";
import { groupMindActivityByRecency } from "@/lib/mindPresentation";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Brain, CircleDot, Network, Sparkles, ThumbsUp } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link } from "wouter";

export default function CreativeDNA() {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const [selectedMemoryId, setSelectedMemoryId] = useState<number | null>(null);
  const mindQuery = trpc.mind.getMind.useQuery(undefined, { enabled: isAuthenticated });
  const creativeDnaQuery = trpc.mind.getCreativeDNA.useQuery(undefined, { enabled: isAuthenticated });
  const mindActivityQuery = trpc.mind.getMindActivity.useQuery({ limit: 24 }, { enabled: isAuthenticated });
  const evidenceInput = useMemo(() => ({ memoryId: selectedMemoryId ?? 1 }), [selectedMemoryId]);
  const preferenceEvidenceQuery = trpc.mind.getPreferenceEvidence.useQuery(evidenceInput, { enabled: isAuthenticated && selectedMemoryId !== null });
  const activityGroups = useMemo(() => groupMindActivityByRecency(mindActivityQuery.data ?? []), [mindActivityQuery.data]);

  if (loading || !isAuthenticated) {
    return <main className="workspace-bg grid min-h-screen place-items-center px-6 text-sm text-white/55">Opening your private Creative DNA…</main>;
  }

  const stats = creativeDnaQuery.data?.stats;
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
          <section className="rounded-3xl border border-white/9 bg-white/[.025] p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow text-[9px]">Evidence-backed preferences</p><h2 className="mt-2 font-display text-4xl tracking-[-.06em]">What your Mind knows.</h2></div><p className="max-w-xs text-xs leading-relaxed text-white/38">Confidence grows only when a preference receives additional persisted evidence.</p></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><MindEvidenceDetails memories={creativeDnaQuery.data?.memories ?? []} selectedMemoryId={selectedMemoryId} onSelectMemory={setSelectedMemoryId} onCloseEvidence={() => setSelectedMemoryId(null)} evidence={preferenceEvidenceQuery.data} isLoadingEvidence={preferenceEvidenceQuery.isLoading} /></div></section>
          <aside className="rounded-3xl border border-white/9 bg-[#101015] p-5 sm:p-6"><p className="eyebrow text-[9px]">Mind activity</p><h2 className="mt-2 font-display text-3xl tracking-[-.055em]">Learning over time.</h2><div className="mt-6 space-y-5">{activityGroups.length ? activityGroups.map(group => <section key={group.label}><p className="font-mono text-[10px] uppercase tracking-[.13em] text-[#d8ff83]">{group.label}</p><div className="mt-2 space-y-2">{group.activity.map(item => <article key={item.id} className="rounded-xl border border-white/8 bg-white/[.025] p-3"><p className="text-xs leading-relaxed text-white/75">{item.message}</p><p className="mt-1 text-[10px] text-white/33">{item.activityType.replace(/_/g, " ")} · {new Date(item.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p></article>)}</div></section>) : <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs leading-relaxed text-white/38">Your Mind activity will appear after you teach it or respond to a recommendation.</p>}</div></aside>
        </div>
      </div>
    </main>
  );
}
