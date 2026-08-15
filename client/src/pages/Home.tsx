import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowRight, Brain, Link2, Network, Scissors, Sparkles, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const features = [
  {
    icon: Brain,
    kicker: "Remember",
    title: "A Mind with your point of view.",
    body: "Teach SoulCut the voice, pacing, audience, and creative choices you want it to protect.",
  },
  {
    icon: Network,
    kicker: "Recommend",
    title: "Ideas with a reason to fit.",
    body: "See grounded brief and clip recommendations alongside the stored creative signals shaping them.",
  },
  {
    icon: ThumbsUp,
    kicker: "Learn",
    title: "Better after every decision.",
    body: "Keep what feels right or correct what does not. Your Creative DNA updates with evidence, not guesses.",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [videoUrl, setVideoUrl] = useState("");

  const openWorkspace = (targetPath = "/app") => {
    if (videoUrl.trim()) {
      sessionStorage.setItem("soulcut:pending-url", videoUrl.trim());
    }
    if (isAuthenticated) {
      setLocation(targetPath);
      return;
    }
    startLogin(targetPath);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#060608] dark:text-white">
      <section className="hero-shell relative isolate min-h-[720px] overflow-hidden">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-orb hero-orb--violet" aria-hidden="true" />
        <div className="hero-orb hero-orb--gold" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />

        <header className="relative z-10 px-4 pt-4 sm:px-6 sm:pt-5 lg:px-10">
          <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-2 backdrop-blur-xl shadow-sm dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none sm:px-5 sm:py-2.5">
            <button type="button" onClick={() => setLocation("/")} className="flex items-center gap-2.5 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-md dark:bg-white dark:text-black dark:shadow-[0_0_24px_rgba(255,255,255,.25)]">
                <Scissors size={15} strokeWidth={2.7} />
              </span>
              <span className="font-display text-lg tracking-[-0.04em] text-slate-900 dark:text-white">SoulCut</span>
            </button>
            <div className="hidden items-center gap-7 text-xs font-medium text-slate-600 dark:text-white/60 md:flex">
              <a className="transition hover:text-slate-900 dark:hover:text-white" href="#how-it-works">The loop</a>
              <a className="transition hover:text-slate-900 dark:hover:text-white" href="#features">Creative DNA</a>
              <a className="transition hover:text-slate-900 dark:hover:text-white" href="#method">Workspace</a>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => openWorkspace("/app")}
                className="rounded-full border border-slate-200 bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white dark:hover:text-black active:scale-[0.97]"
              >
                {isAuthenticated ? "Open workspace" : "Sign in"}
              </button>
            </div>
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pb-16 pt-12 text-center sm:px-5 sm:pb-20 sm:pt-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.045] dark:text-white/70 dark:shadow-none">
            <Brain size={14} className="text-lime-600 dark:text-[#c7ff4b]" />
            Your AI Creative Director
          </div>
          
          <h1 className="max-w-4xl font-display text-[clamp(2.1rem,5.2vw,4.4rem)] leading-[1.08] tracking-[-0.05em] text-slate-900 dark:text-white">
            AI can edit a video.
            <span className="block italic text-slate-500 dark:text-white/40">SoulCut learns how you create.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:mt-6 sm:text-base dark:text-white/60">
            Your Creative Mind remembers the choices you teach, what you keep, what you correct, and what you do not like—then applies that evidence to the next video.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => openWorkspace("/app")}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-[#e9ffe2] dark:text-[#111710] dark:hover:bg-[#c7ff4b] active:scale-[0.97]"
            >
              Meet your Creative Mind <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={() => openWorkspace("/app")}
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400 dark:border-white/12 dark:bg-white/[.035] dark:text-white/75 dark:shadow-none dark:hover:border-[#c7ff4b]/45 dark:hover:text-[#d8ff83]"
            >
              Analyze a video
            </button>
          </div>

          <p className="mt-4 text-[10px] font-semibold tracking-[.1em] text-lime-700 dark:text-[#d8ff83]/80">
            POWERED BY MINDS <span className="px-1 text-slate-400 dark:text-white/30">•</span> PERSISTENT CREATIVE MEMORY
          </p>

          <div className="mt-8 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-2 shadow-xl backdrop-blur-2xl dark:border-white/12 dark:bg-[#121216]/85 dark:shadow-[0_20px_80px_rgba(0,0,0,.4)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
                <Link2 className="shrink-0 text-slate-400 dark:text-white/40" size={17} />
                <input
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") openWorkspace("/app"); }}
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400 sm:text-sm dark:text-white dark:placeholder:text-white/35"
                  placeholder="Paste a YouTube, Vimeo, or public video URL"
                  aria-label="Public video URL"
                />
              </div>
              <button
                type="button"
                onClick={() => openWorkspace("/app")}
                className="group flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-[#e9ffe2] dark:text-[#111710] dark:hover:bg-[#c7ff4b] active:scale-[0.97]"
              >
                Analyze a video
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-white/35">Public URLs only. Your Mind and Creative DNA remain private to your workspace.</p>

          <div className="mt-12 grid w-full max-w-2xl grid-cols-2 gap-3 border-y border-slate-200 py-4 sm:grid-cols-4 sm:gap-6 dark:border-white/10">
            {[["01", "Teach"], ["02", "Create"], ["03", "Correct"], ["04", "Remember"]].map(([number, label]) => (
              <div key={number} className="text-left">
                <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-lime-700 dark:text-[#c7ff4b]">{number}</p>
                <p className="mt-0.5 font-display text-lg tracking-[-0.03em] text-slate-900 sm:text-xl dark:text-white/85">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200 bg-slate-100/70 px-4 py-14 sm:px-8 sm:py-16 lg:py-24 dark:border-white/8 dark:bg-[#0a0a0d]">
        <div className="mx-auto grid max-w-6xl items-end gap-8 lg:grid-cols-[1fr_1.25fr] lg:gap-10">
          <div>
            <p className="eyebrow text-slate-600 dark:text-white/50">The creative learning loop</p>
            <h2 className="mt-3 max-w-md font-display text-3xl leading-[1.08] tracking-[-.05em] text-slate-900 sm:text-5xl dark:text-white">
              Start with a <span className="italic text-slate-500 dark:text-white/40">point of view.</span>
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-px sm:overflow-hidden sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-slate-200 dark:sm:border-white/10 dark:sm:bg-white/10">
            {[
              ["01", "Mind", "Teach the creative choices you want SoulCut to remember."],
              ["02", "Analyze", "Ground the brief in accessible public video context."],
              ["03", "Recommend", "Prioritize moments that fit your Creative DNA."],
              ["04", "Learn", "Use every keep or correction to refine what comes next."],
            ].map(([index, heading, body]) => (
              <article key={index} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-none sm:border-none sm:shadow-none dark:bg-[#111116] sm:p-6">
                <span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-lime-700 dark:text-[#c7ff4b]">{index}</span>
                <h3 className="mt-6 font-display text-2xl tracking-[-0.04em] text-slate-900 sm:mt-8 dark:text-white">{heading}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-white/50">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-slate-50 px-4 py-14 sm:px-8 sm:py-16 lg:py-24 dark:bg-[#060608]">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div>
              <p className="eyebrow text-slate-600 dark:text-white/50">Creative DNA, made visible</p>
              <h2 className="mt-3 font-display text-3xl tracking-[-0.05em] text-slate-900 sm:text-5xl dark:text-white">Taste, with receipts.</h2>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-slate-600 dark:text-white/50">
              Every preference carries a source, confidence, evidence count, and update history you can inspect at any time.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-3">
            {features.map(({ icon: Icon, kicker, title, body }, index) => (
              <article key={kicker} className={`feature-card feature-card--${index} group min-h-56 rounded-2xl p-6 sm:min-h-64`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-black/20 dark:text-white/80">
                  <Icon size={18} />
                </span>
                <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 sm:mt-10 dark:text-white/45">{kicker}</p>
                <h3 className="mt-2 max-w-xs font-display text-2xl leading-[1.12] tracking-[-0.04em] text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-600 dark:text-white/55">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="method" className="px-4 pb-8 sm:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 px-6 py-10 text-white shadow-xl sm:px-12 sm:py-16 dark:border-white/10 dark:bg-[#16151d]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(199,255,75,.14),transparent_25%),radial-gradient(circle_at_20%_100%,rgba(150,107,255,.18),transparent_32%)]" />
          <div className="relative grid items-end gap-6 md:grid-cols-[1.15fr_.85fr] md:gap-8">
            <div>
              <p className="eyebrow text-white/70">Your creative operating system</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl leading-[1.08] tracking-[-.05em] text-white sm:text-5xl">
                Less re-explaining. <span className="italic text-white/60">More making.</span>
              </h2>
            </div>
            <div className="md:justify-self-end">
              <p className="max-w-xs text-xs leading-relaxed text-white/75">
                Your Mind, Creative DNA, video briefs, evidence, and exports stay organized in one private workspace.
              </p>
              <button
                type="button"
                onClick={() => openWorkspace("/app")}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-slate-900 transition hover:bg-[#c7ff4b] active:scale-[0.97]"
              >
                Open SoulCut <Sparkles size={15} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-white/35">
        <span className="font-display text-base tracking-[-0.04em] text-slate-900 dark:text-white/70">SoulCut</span>
        <span>An AI Creative Director that learns your taste.</span>
      </footer>
    </main>
  );
}
