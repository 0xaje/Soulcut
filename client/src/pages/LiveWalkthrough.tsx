import { useAuth } from "@/_core/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Brain, CheckCircle2, CircleDot, History, LogOut, Network, Sparkles } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type WalkthroughStep = {
  time: string;
  title: string;
  description: string;
  href: string;
  ready: boolean;
  readyLabel: string;
  pendingLabel: string;
};

export default function LiveWalkthrough() {
  const { loading, isAuthenticated, logout } = useAuth({ redirectOnUnauthenticated: true });
  const [activeComparisonTab, setActiveComparisonTab] = React.useState<"generic" | "soulcut">("soulcut");

  const mindQuery = trpc.mind.getMind.useQuery(undefined, { enabled: isAuthenticated });
  const dnaQuery = trpc.mind.getCreativeDNA.useQuery(undefined, { enabled: isAuthenticated });
  const jobsQuery = trpc.videoJobs.list.useQuery(undefined, { enabled: isAuthenticated });
  const comparisonQuery = trpc.mind.getRecommendationComparison.useQuery(undefined, { enabled: isAuthenticated });

  if (loading || !isAuthenticated) {
    return <main className="workspace-bg grid min-h-screen place-items-center px-6 text-sm text-slate-500 dark:text-white/55">Opening your live walkthrough…</main>;
  }

  const mind = mindQuery.data?.mind;
  const preferences = dnaQuery.data?.memories ?? [];
  const stats = dnaQuery.data?.stats;
  const completedJobs = (jobsQuery.data ?? []).filter(job => job.status === "done");
  const comparisons = comparisonQuery.data ?? [];
  const steps: WalkthroughStep[] = [
    { time: "00:00", title: "The SoulCut story", description: "Open the landing page and establish the difference: AI can edit a video; SoulCut learns how this creator creates.", href: "/", ready: true, readyLabel: "Ready", pendingLabel: "Ready" },
    { time: "00:10", title: "Meet the Creative Mind", description: "Show that SoulCut is the creative experience and Minds is the persistent intelligence layer beneath it.", href: "/app", ready: Boolean(mind), readyLabel: "Mind available", pendingLabel: "Open workspace" },
    { time: "00:20", title: "Teach the Mind", description: "Teach an explicit preference. The lesson becomes a persisted memory and appears in Creative DNA with evidence.", href: "/app", ready: preferences.length > 0, readyLabel: `${preferences.length} preference${preferences.length === 1 ? "" : "s"} recorded`, pendingLabel: "Teach a preference" },
    { time: "00:35", title: "Analyze Video 1", description: "Ask the Mind to find grounded creative opportunities. The durable job stores the bounded Mind snapshot actually used.", href: "/app", ready: completedJobs.length >= 1, readyLabel: `${completedJobs.length} completed video${completedJobs.length === 1 ? "" : "s"}`, pendingLabel: "Analyze a public video" },
    { time: "01:15", title: "Correct a recommendation", description: "Keep or correct an actual clip. The feedback event creates real evidence; repeated choices can later become a behavioral pattern.", href: "/app", ready: (stats?.feedbackCount ?? 0) > 0, readyLabel: `${stats?.feedbackCount ?? 0} feedback signal${(stats?.feedbackCount ?? 0) === 1 ? "" : "s"}`, pendingLabel: "Record feedback" },
    { time: "01:35", title: "Prove the second-video memory", description: "Analyze another video without restating style. The saved result shows “Your Mind remembered” and the preferences applied at analysis time.", href: "/app", ready: completedJobs.length >= 2, readyLabel: "Two-video proof available", pendingLabel: "Complete a second video" },
    { time: "02:10", title: "Explain why this fits", description: "Open a clip’s “Why does my Mind think this?” panel. Every displayed reason must be backed by the creator’s persisted evidence.", href: "/app", ready: completedJobs.length >= 1 && preferences.length > 0, readyLabel: "Grounded explanation ready", pendingLabel: "Add a preference and complete a video" },
    { time: "02:25", title: "Show Creative Evolution", description: "Compare the stored Mind context, evidence signals, clip opportunities, and explicit feedback across completed videos. No performance score is invented.", href: "/evolution", ready: comparisons.length >= 2, readyLabel: "Comparison available", pendingLabel: "Complete two saved analyses" },
  ];

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
            <Link href="/evolution" className="inline-flex items-center gap-1.5 rounded-full border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-2xs transition hover:border-slate-600 hover:bg-slate-50 dark:border-white/12 dark:bg-white/[.06] dark:text-white dark:hover:border-white/25 dark:hover:bg-white/12">
              <History size={13} className="text-slate-700 dark:text-white/70" />
              <span>Evolution</span>
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

      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-300/80 bg-slate-100/90 p-6 shadow-sm dark:border-white/10 dark:bg-[#111116] sm:p-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl dark:bg-purple-500/[.07]" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <p className="eyebrow text-slate-700 dark:text-white/60">Live judge walkthrough</p>
            <h1 className="mt-3 font-display text-3xl leading-[1.08] tracking-[-.04em] text-slate-900 sm:text-5xl dark:text-white">
              Your Mind <span className="italic text-slate-500 dark:text-white/42">remembers.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-white/55">
              This guide uses your current persisted SoulCut state. It does not create sample activity, substitute test data, or claim a step is complete until the relevant Mind, job, feedback, or comparison record exists.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 font-mono text-[11px] font-semibold text-slate-800 dark:border-white/12 dark:bg-white/[.06] dark:text-white/80">
              <Brain size={13} /> {mindQuery.data?.builderAvailability === "available" ? "SoulCut experience · Minds persistent intelligence" : "SoulCut persistent creative memory"}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-[9px] text-lime-700 dark:text-[#d8ff83]">A real two-minute walkthrough</p>
              <h2 className="mt-2 font-display text-3xl tracking-[-.05em] text-slate-900 dark:text-white">Teach. Create. Correct. Remember.</h2>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-white/38">Each status below is derived from the authenticated creator’s saved state.</p>
          </div>
          <div className="mt-6 space-y-3">
            {steps.map(step => (
              <Link
                key={step.time}
                href={step.href}
                className="group grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-lime-400 hover:shadow-md dark:border-white/8 dark:bg-white/[.025] dark:shadow-none dark:hover:border-[#c7ff4b]/30 dark:hover:bg-[#c7ff4b]/[.035] sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <p className="font-mono text-[10px] font-bold tracking-[.13em] text-lime-700 dark:text-[#d8ff83]">{step.time}</p>
                </div>
                <div>
                  <p className="font-display text-xl tracking-[-.03em] text-slate-900 dark:text-white">{step.title}</p>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-white/47">{step.description}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold ${step.ready ? "border-lime-300 bg-lime-100 text-lime-900 dark:border-[#c7ff4b]/25 dark:bg-[#c7ff4b]/10 dark:text-[#d8ff83]" : "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-transparent dark:text-white/48"}`}>
                  {step.ready ? <CheckCircle2 size={12} /> : <CircleDot size={12} />}
                  {step.ready ? step.readyLabel : step.pendingLabel}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Interactive Side-by-Side Proof Card */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/9 dark:bg-[#111116] dark:shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow text-lime-700 dark:text-[#d8ff83]">The Secret Sauce</p>
              <h2 className="mt-1 font-display text-2xl tracking-[-.04em] text-slate-900 dark:text-white">Generic AI Clipping vs. SoulCut Creative Mind</h2>
            </div>
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/[.04]">
              <button
                type="button"
                onClick={() => setActiveComparisonTab("generic")}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                  activeComparisonTab === "generic"
                    ? "bg-slate-900 text-white dark:bg-white/20 dark:text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-white/50 dark:hover:text-white"
                }`}
              >
                Generic AI (0-Memory)
              </button>
              <button
                type="button"
                onClick={() => setActiveComparisonTab("soulcut")}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                  activeComparisonTab === "soulcut"
                    ? "bg-lime-400 text-black shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 dark:text-white/50 dark:hover:text-white"
                }`}
              >
                SoulCut + Minds API
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className={`rounded-2xl border p-5 transition ${
              activeComparisonTab === "generic"
                ? "border-red-300 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/[.04]"
                : "border-slate-200 bg-slate-50/50 opacity-60 dark:border-white/5 dark:bg-white/[.01]"
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-red-700 dark:text-red-400">GENERIC AI TOOLS</span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">Stateless</span>
              </div>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-700 dark:text-white/70">
                <li className="flex items-start gap-2">❌ <strong>Cookie-Cutter Clips:</strong> Same generic quotes generated for every single user.</li>
                <li className="flex items-start gap-2">❌ <strong>Zero Memory:</strong> Forgets your pacing, hook styles, and corrections immediately after every run.</li>
                <li className="flex items-start gap-2">❌ <strong>Black-Box Scoring:</strong> Gives a meaningless "Virality 87/100" with no audit trail or evidence.</li>
                <li className="flex items-start gap-2">❌ <strong>No Pro Workflow:</strong> Cannot export to NLE timelines (Premiere, FCPXML, CapCut).</li>
              </ul>
            </div>

            <div className={`rounded-2xl border p-5 transition ${
              activeComparisonTab === "soulcut"
                ? "border-lime-400/60 bg-lime-400/10 shadow-md dark:border-[#c7ff4b]/40 dark:bg-[#c7ff4b]/[0.05]"
                : "border-slate-200 bg-slate-50/50 opacity-60 dark:border-white/5 dark:bg-white/[.01]"
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-lime-800 dark:text-[#d8ff83]">SOULCUT + MINDS API</span>
                <span className="rounded-full bg-lime-200 px-2 py-0.5 text-[10px] font-bold text-lime-900 dark:bg-[#c7ff4b]/20 dark:text-[#d8ff83]">Evolving Mind</span>
              </div>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-800 dark:text-white/90">
                <li className="flex items-start gap-2">✅ <strong>Persistent Creative DNA:</strong> Remembers your hooks, pacing, and editorial preferences across all videos.</li>
                <li className="flex items-start gap-2">✅ <strong>Adaptive Feedback Loop:</strong> Every "Keep" or "Not My Style" refines dynamic confidence ratings (1-100%).</li>
                <li className="flex items-start gap-2">✅ <strong>Evidence-Backed Citing:</strong> Every clip recommendation cites exact creator rules and historical evidence.</li>
                <li className="flex items-start gap-2">✅ <strong>Pro Editor Suite:</strong> 1-click export to Premiere EDL, Final Cut Pro XML, CapCut JSON, SRT subtitles, and PDF briefs.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-white/9 dark:bg-white/[.025] dark:shadow-none">
          <p className="eyebrow text-[9px] text-lime-700 dark:text-[#d8ff83]">The Minds story</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-white/62">
            SoulCut is an AI Creative Director for creators. Minds provides the persistent intelligence layer that allows SoulCut to remember the creator’s evidence-backed hooks, pacing, voice, audience, and corrections across sessions. Remove that persistent Mind and SoulCut loses the cross-video creative memory that makes the second-video proof possible.
          </p>
        </section>
      </div>
    </main>
  );
}
