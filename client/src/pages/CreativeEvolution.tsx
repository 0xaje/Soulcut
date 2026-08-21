import { useAuth } from "@/_core/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Brain, Film, LogOut, Network, Sparkles } from "lucide-react";
import React, { useMemo } from "react";
import { toast } from "sonner";
import { Link } from "wouter";


function sourceLabel(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Public source"; }
}

function MetricBar({ label, value, max, accent = "bg-lime-500 dark:bg-[#c7ff4b]" }: { label: string; value: number; max: number; accent?: string }) {
  const width = max ? Math.max(value ? 8 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 dark:text-white/38">
        <span>{label}</span>
        <span className="font-mono text-slate-700 dark:text-white/62">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/8">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function CreativeEvolution() {
  const { loading, isAuthenticated, logout } = useAuth({ redirectOnUnauthenticated: true });
  const comparisonQuery = trpc.mind.getRecommendationComparison.useQuery(undefined, { enabled: isAuthenticated });
  const comparison = comparisonQuery.data ?? [];
  const maxApplied = useMemo(() => Math.max(1, ...comparison.map(item => item.appliedPreferenceCount)), [comparison]);
  const maxClips = useMemo(() => Math.max(1, ...comparison.map(item => item.clipCount)), [comparison]);
  const maxFeedback = useMemo(() => Math.max(1, ...comparison.map(item => item.keptCount + item.correctedCount)), [comparison]);
  const maxEvidence = useMemo(() => Math.max(1, ...comparison.map(item => item.appliedPreferences.reduce((sum, preference) => sum + preference.evidenceCount, 0))), [comparison]);
  const first = comparison[0];
  const latest = comparison.at(-1);

  if (loading || !isAuthenticated) return <main className="workspace-bg grid min-h-screen place-items-center px-6 text-sm text-slate-500 dark:text-white/55">Opening your private Creative Evolution…</main>;

  return (
    <main className="workspace-bg min-h-screen text-slate-900 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-300/80 bg-slate-100/95 px-4 py-3 backdrop-blur-xl dark:border-white/8 dark:bg-[#08080b]/85 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm dark:bg-white dark:text-black">
              <Sparkles size={15} strokeWidth={2.7} />
            </span>
            <span className="font-display text-lg tracking-[-0.04em] text-slate-900 dark:text-white">SoulCut</span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-2.5">
            <Link href="/app" className="inline-flex items-center gap-1.5 rounded-full border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-2xs transition hover:border-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-white/[.06] dark:text-white dark:hover:border-white/25 dark:hover:bg-white/12">
              <ArrowLeft size={13} />
              <span>Workspace</span>
            </Link>
            <Link href="/dna" className="inline-flex items-center gap-1.5 rounded-full border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-2xs transition hover:border-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-white/[.06] dark:text-white dark:hover:border-white/25 dark:hover:bg-white/12">
              <Network size={13} className="text-slate-700 dark:text-white/70" />
              <span>Creative DNA</span>
            </Link>
            <Link href="/walkthrough" className="inline-flex items-center gap-1.5 rounded-full border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-2xs transition hover:border-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-white/[.06] dark:text-white dark:hover:border-white/25 dark:hover:bg-white/12">
              <Sparkles size={13} className="text-slate-700 dark:text-white/70" />
              <span>Walkthrough</span>
            </Link>
            <ThemeToggle />
            <button
              onClick={async () => {
                await logout();
                toast.success("Signed out successfully.");
              }}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-200/80 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-300 active:scale-[.97] dark:border-white/10 dark:bg-white/[.04] dark:text-white/62 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <LogOut size={13} /> <span className="hidden md:inline">Sign out</span>
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-300/80 bg-slate-100/90 p-6 shadow-sm dark:border-white/10 dark:bg-[#111116] sm:p-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl dark:bg-purple-500/[.07]" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <p className="eyebrow text-slate-700 dark:text-white/60">Persistent creative memory</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl leading-[1.08] tracking-[-.04em] text-slate-900 sm:text-5xl dark:text-white">
                Your Creative <span className="italic text-slate-500 dark:text-white/42">Evolution.</span>
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[.12em] text-slate-800 dark:border-white/12 dark:bg-white/[.06] dark:text-white/80">
                <Brain size={10} /> Mind learning history
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-white/55">
              Your Mind is not static. It learns from what you teach, what you keep, and what you correct. This is a private evidence history—not a performance score.
            </p>
          </div>
        </section>

        {comparisonQuery.isLoading ? (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 text-sm text-slate-500 dark:border-white/9 dark:bg-white/[.025] dark:text-white/45">Loading your recorded Creative Evolution…</div>
        ) : comparison.length < 2 ? (
          <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-xs dark:border-white/12 dark:bg-white/[.025] dark:shadow-none">
            <Film className="mx-auto text-lime-700 dark:text-[#d8ff83]" size={24} />
            <h2 className="mt-4 font-display text-2xl tracking-[-.04em] text-slate-900 dark:text-white">Your evolution begins with two completed videos.</h2>
            <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-slate-600 dark:text-white/45">Teach your Mind or respond to a recommendation, then analyze the next video. SoulCut will compare only the persisted context, evidence, and feedback it actually recorded.</p>
            <Link href="/app" className="mt-5 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-[#e9ffe2] dark:text-[#111710]">Ask your Mind</Link>
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/9 dark:bg-white/[.025] dark:shadow-none">
                <p className="eyebrow text-[9px] text-lime-700 dark:text-[#d8ff83]">Applied Creative DNA</p>
                <p className="mt-3 font-display text-3xl tracking-[-.05em] text-slate-900 dark:text-white">{first?.appliedPreferenceCount} <span className="text-slate-400 dark:text-white/35">→</span> {latest?.appliedPreferenceCount}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-white/42">Preferences in the first and latest stored analysis snapshot.</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/9 dark:bg-white/[.025] dark:shadow-none">
                <p className="eyebrow text-[9px] text-lime-700 dark:text-[#d8ff83]">Evidence signals</p>
                <p className="mt-3 font-display text-3xl tracking-[-.05em] text-slate-900 dark:text-white">{comparison.reduce((sum, item) => sum + item.appliedPreferences.reduce((total, preference) => total + preference.evidenceCount, 0), 0)}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-white/42">Persisted evidence behind the Mind context used across these briefs.</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/9 dark:bg-white/[.025] dark:shadow-none">
                <p className="eyebrow text-[9px] text-lime-700 dark:text-[#d8ff83]">Feedback observed</p>
                <p className="mt-3 font-display text-3xl tracking-[-.05em] text-slate-900 dark:text-white">{comparison.reduce((sum, item) => sum + item.keptCount + item.correctedCount, 0)}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-white/42">Kept or corrected recommendations, never inferred engagement.</p>
              </article>
            </section>
            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 dark:border-white/9 dark:bg-white/[.025] dark:shadow-none">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow text-[9px] text-lime-700 dark:text-[#d8ff83]">Learning timeline</p>
                  <h2 className="mt-2 font-display text-3xl tracking-[-.05em] text-slate-900 dark:text-white">What your Mind carried forward.</h2>
                </div>
                <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-white/38">Each card is the actual Mind context saved when that video was analyzed. It can change only after real teaching or feedback.</p>
              </div>
              <div className="mt-6 grid gap-3">
                {comparison.map((item, index) => {
                  const evidenceCount = item.appliedPreferences.reduce((sum, preference) => sum + preference.evidenceCount, 0);
                  return (
                    <article key={item.jobId} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[84px_minmax(0,1fr)_minmax(300px,0.8fr)] lg:items-center dark:border-white/8 dark:bg-black/20">
                      <div>
                        <p className="font-mono text-[10px] font-bold tracking-[.13em] text-lime-700 dark:text-[#d8ff83]">VIDEO {String(index + 1).padStart(2, "0")}</p>
                        <p className="mt-1 text-[10px] text-slate-400 dark:text-white/35">{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white/78">{sourceLabel(item.videoUrl)}</p>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 dark:text-white/35">Applied DNA at analysis time</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.appliedPreferences.length ? item.appliedPreferences.slice(0, 4).map(preference => (
                            <span key={`${preference.category}-${preference.value}`} className="rounded-full border border-lime-300 bg-white px-2 py-1 text-[10px] font-medium text-lime-800 shadow-2xs dark:border-[#c7ff4b]/16 dark:bg-transparent dark:text-[#d8ff83]">
                              {preference.value} <span className="text-slate-400 dark:text-white/35">· {preference.confidence}%</span>
                            </span>
                          )) : <span className="text-xs text-slate-400 dark:text-white/35">No stored Mind context was available for this earlier job.</span>}
                        </div>
                        {item.transcriptFormat && <p className="mt-2 text-[10px] text-slate-500 dark:text-white/36">Creator-provided {item.transcriptFormat.toUpperCase()} transcript</p>}
                      </div>
                      <div className="space-y-2.5">
                        <MetricBar label="Applied DNA" value={item.appliedPreferenceCount} max={maxApplied} />
                        <MetricBar label="Evidence signals" value={evidenceCount} max={maxEvidence} accent="bg-lime-600 dark:bg-[#d8ff83]" />
                        <MetricBar label="Clip opportunities" value={item.clipCount} max={maxClips} accent="bg-slate-400 dark:bg-white/65" />
                        <div className="grid grid-cols-2 gap-3">
                          <MetricBar label="Kept" value={item.keptCount} max={maxFeedback} />
                          <MetricBar label="Corrected" value={item.correctedCount} max={maxFeedback} accent="bg-red-400 dark:bg-red-300/75" />
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
    </main>
  );
}
