import { useAuth } from "@/_core/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Brain, Film, Sparkles } from "lucide-react";
import React, { useMemo } from "react";
import { Link } from "wouter";

function sourceLabel(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Public source"; }
}

function MetricBar({ label, value, max, accent = "bg-[#c7ff4b]" }: { label: string; value: number; max: number; accent?: string }) {
  const width = max ? Math.max(value ? 8 : 0, Math.round((value / max) * 100)) : 0;
  return <div><div className="flex items-center justify-between text-[10px] uppercase tracking-[.11em] text-white/38"><span>{label}</span><span className="font-mono text-white/62">{value}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className={`h-full rounded-full ${accent}`} style={{ width: `${width}%` }} /></div></div>;
}

export default function CreativeEvolution() {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const comparisonQuery = trpc.mind.getRecommendationComparison.useQuery(undefined, { enabled: isAuthenticated });
  const comparison = comparisonQuery.data ?? [];
  const maxApplied = useMemo(() => Math.max(1, ...comparison.map(item => item.appliedPreferenceCount)), [comparison]);
  const maxClips = useMemo(() => Math.max(1, ...comparison.map(item => item.clipCount)), [comparison]);
  const maxFeedback = useMemo(() => Math.max(1, ...comparison.map(item => item.keptCount + item.correctedCount)), [comparison]);
  const maxEvidence = useMemo(() => Math.max(1, ...comparison.map(item => item.appliedPreferences.reduce((sum, preference) => sum + preference.evidenceCount, 0))), [comparison]);
  const first = comparison[0];
  const latest = comparison.at(-1);

  if (loading || !isAuthenticated) return <main className="workspace-bg grid min-h-screen place-items-center px-6 text-sm text-white/55">Opening your private Creative Evolution…</main>;

  return <main className="workspace-bg min-h-screen text-white">
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#08080b]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black"><Sparkles size={15} strokeWidth={2.7} /></span>
          <span className="font-display text-lg tracking-[-.04em]">SoulCut</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <Link href="/dna" className="hidden rounded-full border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:text-[#d8ff83] sm:block">Creative DNA</Link>
          <Link href="/app" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/65 transition hover:border-[#c7ff4b]/45 hover:text-[#d8ff83]"><ArrowLeft size={14} /> Workspace</Link>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#c7ff4b]/18 bg-[#10140f] p-6 sm:p-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#c7ff4b]/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="eyebrow text-[#d8ff83]">Persistent creative memory</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl leading-[1.08] tracking-[-.04em] sm:text-5xl">Your Creative <span className="italic text-white/42">Evolution.</span></h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#c7ff4b]/20 bg-[#c7ff4b]/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-[#d8ff83]"><Brain size={10} /> Mind learning history</span>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">Your Mind is not static. It learns from what you teach, what you keep, and what you correct. This is a private evidence history—not a performance score.</p>
        </div>
      </section>

      {comparisonQuery.isLoading ? (
        <div className="mt-6 rounded-3xl border border-white/9 bg-white/[.025] p-7 text-sm text-white/45">Loading your recorded Creative Evolution…</div>
      ) : comparison.length < 2 ? (
        <section className="mt-6 rounded-3xl border border-dashed border-white/12 bg-white/[.025] p-8 text-center">
          <Film className="mx-auto text-[#d8ff83]" size={24} />
          <h2 className="mt-4 font-display text-2xl tracking-[-.04em]">Your evolution begins with two completed videos.</h2>
          <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-white/45">Teach your Mind or respond to a recommendation, then analyze the next video. SoulCut will compare only the persisted context, evidence, and feedback it actually recorded.</p>
          <Link href="/app" className="mt-5 inline-flex rounded-full bg-[#e9ffe2] px-4 py-2 text-xs font-semibold text-[#111710]">Ask your Mind</Link>
        </section>
      ) : (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/9 bg-white/[.025] p-5">
              <p className="eyebrow text-[9px]">Applied Creative DNA</p>
              <p className="mt-3 font-display text-3xl tracking-[-.05em]">{first?.appliedPreferenceCount} <span className="text-white/35">→</span> {latest?.appliedPreferenceCount}</p>
              <p className="mt-2 text-xs text-white/42">Preferences in the first and latest stored analysis snapshot.</p>
            </article>
            <article className="rounded-2xl border border-white/9 bg-white/[.025] p-5">
              <p className="eyebrow text-[9px]">Evidence signals</p>
              <p className="mt-3 font-display text-3xl tracking-[-.05em]">{comparison.reduce((sum, item) => sum + item.appliedPreferences.reduce((total, preference) => total + preference.evidenceCount, 0), 0)}</p>
              <p className="mt-2 text-xs text-white/42">Persisted evidence behind the Mind context used across these briefs.</p>
            </article>
            <article className="rounded-2xl border border-white/9 bg-white/[.025] p-5">
              <p className="eyebrow text-[9px]">Feedback observed</p>
              <p className="mt-3 font-display text-3xl tracking-[-.05em]">{comparison.reduce((sum, item) => sum + item.keptCount + item.correctedCount, 0)}</p>
              <p className="mt-2 text-xs text-white/42">Kept or corrected recommendations, never inferred engagement.</p>
            </article>
          </section>
          <section className="mt-6 rounded-3xl border border-white/9 bg-white/[.025] p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow text-[9px]">Learning timeline</p>
                <h2 className="mt-2 font-display text-3xl tracking-[-.05em]">What your Mind carried forward.</h2>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-white/38">Each card is the actual Mind context saved when that video was analyzed. It can change only after real teaching or feedback.</p>
            </div>
            <div className="mt-6 grid gap-3">
              {comparison.map((item, index) => {
                const evidenceCount = item.appliedPreferences.reduce((sum, preference) => sum + preference.evidenceCount, 0);
                return (
                  <article key={item.jobId} className="grid gap-4 rounded-2xl border border-white/8 bg-black/20 p-4 lg:grid-cols-[84px_minmax(0,1fr)_minmax(300px,0.8fr)] lg:items-center">
                    <div>
                      <p className="font-mono text-[10px] tracking-[.13em] text-[#d8ff83]">VIDEO {String(index + 1).padStart(2, "0")}</p>
                      <p className="mt-1 text-[10px] text-white/35">{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                    </div>
                    <div>
                      <p className="text-sm text-white/78">{sourceLabel(item.videoUrl)}</p>
                      <p className="mt-2 text-[10px] uppercase tracking-[.11em] text-white/35">Applied DNA at analysis time</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {item.appliedPreferences.length ? item.appliedPreferences.slice(0, 4).map(preference => (
                          <span key={`${preference.category}-${preference.value}`} className="rounded-full border border-[#c7ff4b]/16 px-2 py-1 text-[10px] text-[#d8ff83]">
                            {preference.value} <span className="text-white/35">· {preference.confidence}%</span>
                          </span>
                        )) : <span className="text-xs text-white/35">No stored Mind context was available for this earlier job.</span>}
                      </div>
                      {item.transcriptFormat && <p className="mt-2 text-[10px] text-white/36">Creator-provided {item.transcriptFormat.toUpperCase()} transcript</p>}
                    </div>
                    <div className="space-y-2.5">
                      <MetricBar label="Applied DNA" value={item.appliedPreferenceCount} max={maxApplied} />
                      <MetricBar label="Evidence signals" value={evidenceCount} max={maxEvidence} accent="bg-[#d8ff83]" />
                      <MetricBar label="Clip opportunities" value={item.clipCount} max={maxClips} accent="bg-white/65" />
                      <div className="grid grid-cols-2 gap-3">
                        <MetricBar label="Kept" value={item.keptCount} max={maxFeedback} />
                        <MetricBar label="Corrected" value={item.correctedCount} max={maxFeedback} accent="bg-red-300/75" />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  </main>;
}
