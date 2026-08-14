import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Brain, CheckCircle2, CircleDot, Sparkles } from "lucide-react";
import React from "react";
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
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const mindQuery = trpc.mind.getMind.useQuery(undefined, { enabled: isAuthenticated });
  const dnaQuery = trpc.mind.getCreativeDNA.useQuery(undefined, { enabled: isAuthenticated });
  const jobsQuery = trpc.videoJobs.list.useQuery(undefined, { enabled: isAuthenticated });
  const comparisonQuery = trpc.mind.getRecommendationComparison.useQuery(undefined, { enabled: isAuthenticated });

  if (loading || !isAuthenticated) {
    return <main className="workspace-bg grid min-h-screen place-items-center px-6 text-sm text-white/55">Opening your live walkthrough…</main>;
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

  return <main className="workspace-bg min-h-screen text-white">
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#08080b]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black"><Sparkles size={15} strokeWidth={2.7} /></span><span className="font-display text-lg tracking-[-.04em]">SoulCut</span></Link>
        <Link href="/app" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/65 transition hover:border-[#c7ff4b]/45 hover:text-[#d8ff83]"><ArrowLeft size={14} /> Workspace</Link>
      </div>
    </header>
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:py-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#c7ff4b]/18 bg-[#10140f] p-6 sm:p-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#c7ff4b]/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="eyebrow text-[#d8ff83]">Live judge walkthrough</p>
          <h1 className="mt-3 font-display text-3xl leading-[1.08] tracking-[-.04em] sm:text-5xl">Your Mind <span className="italic text-white/42">remembers.</span></h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">This guide uses your current persisted SoulCut state. It does not create sample activity, substitute test data, or claim a step is complete until the relevant Mind, job, feedback, or comparison record exists.</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#c7ff4b]/20 bg-[#c7ff4b]/10 px-3 py-1.5 text-[11px] text-[#d8ff83]"><Brain size={13} /> {mindQuery.data?.builderAvailability === "available" ? "SoulCut experience · Minds persistent intelligence" : "SoulCut persistent creative memory"}</div>
        </div>
      </section>
      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-[9px]">A real two-minute walkthrough</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-.05em]">Teach. Create. Correct. Remember.</h2>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-white/38">Each status below is derived from the authenticated creator’s saved state.</p>
        </div>
        <div className="mt-6 space-y-3">
          {steps.map(step => (
            <Link key={step.time} href={step.href} className="group grid gap-4 rounded-2xl border border-white/8 bg-white/[.025] p-4 transition hover:border-[#c7ff4b]/30 hover:bg-[#c7ff4b]/[.035] sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="font-mono text-[10px] tracking-[.13em] text-[#d8ff83]">{step.time}</p>
              </div>
              <div>
                <p className="font-display text-xl tracking-[-.03em] text-white">{step.title}</p>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/47">{step.description}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] ${step.ready ? "border-[#c7ff4b]/25 bg-[#c7ff4b]/10 text-[#d8ff83]" : "border-white/10 text-white/48"}`}>
                {step.ready ? <CheckCircle2 size={12} /> : <CircleDot size={12} />}
                {step.ready ? step.readyLabel : step.pendingLabel}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-6 rounded-3xl border border-white/9 bg-white/[.025] p-5 sm:p-6">
        <p className="eyebrow text-[9px]">The Minds story</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/62">SoulCut is an AI Creative Director for creators. Minds provides the persistent intelligence layer that allows SoulCut to remember the creator’s evidence-backed hooks, pacing, voice, audience, and corrections across sessions. Remove that persistent Mind and SoulCut loses the cross-video creative memory that makes the second-video proof possible.</p>
      </section>
    </div>
  </main>;
}
