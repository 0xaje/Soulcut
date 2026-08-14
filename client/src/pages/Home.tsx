import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Clock3,
  FileText,
  Link2,
  Play,
  Scissors,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

const features = [
  {
    icon: FileText,
    kicker: "Distill",
    title: "The signal, not the noise.",
    body: "Turn public video links into a focused, skimmable brief with the ideas that matter most.",
  },
  {
    icon: Scissors,
    kicker: "Reframe",
    title: "Find short-form moments.",
    body: "Surface clip concepts, strong hooks, and grounded timestamp ranges for your next social cut.",
  },
  {
    icon: Clock3,
    kicker: "Remember",
    title: "Every analysis, in one place.",
    body: "Return to your past summaries and clip boards whenever you need to shape the next idea.",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [videoUrl, setVideoUrl] = useState("");

  const openWorkspace = () => {
    if (videoUrl.trim()) {
      sessionStorage.setItem("soulcut:pending-url", videoUrl.trim());
    }
    if (isAuthenticated) {
      setLocation("/app");
      return;
    }
    startLogin();
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#060608] text-white">
      <section className="hero-shell relative isolate min-h-[790px] overflow-hidden">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-orb hero-orb--violet" aria-hidden="true" />
        <div className="hero-orb hero-orb--gold" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />

        <header className="relative z-10 px-4 pt-5 sm:px-6 lg:px-10">
          <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/10 bg-white/[0.045] px-4 py-3 backdrop-blur-xl sm:px-5">
            <button type="button" onClick={() => setLocation("/")} className="flex items-center gap-3 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-[0_0_28px_rgba(255,255,255,.25)]">
                <Scissors size={15} strokeWidth={2.7} />
              </span>
              <span className="font-display text-lg tracking-[-0.04em]">SoulCut</span>
            </button>
            <div className="hidden items-center gap-7 text-sm text-white/55 md:flex">
              <a className="transition hover:text-white" href="#how-it-works">How it works</a>
              <a className="transition hover:text-white" href="#features">Capabilities</a>
              <a className="transition hover:text-white" href="#method">Method</a>
            </div>
            <button
              type="button"
              onClick={openWorkspace}
              className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black active:scale-[0.97]"
            >
              {isAuthenticated ? "Open workspace" : "Sign in"}
            </button>
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-5 pb-24 pt-24 text-center sm:pt-32">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3.5 py-1.5 text-xs font-medium text-white/65 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c7ff4b] shadow-[0_0_12px_#c7ff4b]" />
            Video intelligence for social storytellers
          </div>
          <h1 className="max-w-5xl font-display text-[clamp(4.4rem,11vw,9.7rem)] leading-[0.78] tracking-[-0.075em] text-white">
            Make the long
            <span className="block text-white/35 italic">worth watching.</span>
          </h1>
          <p className="mt-9 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">
            Send a public video link. Get a concise brief, its key ideas, and the moments worth turning into your next short.
          </p>

          <div className="mt-10 w-full max-w-2xl rounded-[1.7rem] border border-white/12 bg-[#121216]/85 p-2 shadow-[0_24px_100px_rgba(0,0,0,.42)] backdrop-blur-2xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5">
                <Link2 className="shrink-0 text-white/35" size={19} />
                <input
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") openWorkspace();
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                  placeholder="Paste a YouTube, Vimeo, or public video URL"
                  aria-label="Public video URL"
                />
              </div>
              <button
                type="button"
                onClick={openWorkspace}
                className="group flex items-center justify-center gap-2 rounded-[1.15rem] bg-[#e9ffe2] px-5 py-3 text-sm font-semibold text-[#111710] transition hover:bg-[#c7ff4b] active:scale-[0.97]"
              >
                Analyze video
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/32">Public URLs only. You control what you submit.</p>

          <div className="mt-16 grid w-full max-w-3xl grid-cols-3 gap-2 border-y border-white/10 py-5 sm:gap-8">
            {[
              ["01", "Link it"],
              ["02", "Read it"],
              ["03", "Cut it"],
            ].map(([number, label]) => (
              <div key={number} className="text-left">
                <p className="font-mono text-[10px] tracking-[0.16em] text-[#c7ff4b]">{number}</p>
                <p className="mt-1 font-display text-xl tracking-[-0.04em] text-white/78 sm:text-2xl">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/35">
          <span>Scroll to explore</span>
          <span className="h-px w-8 bg-white/30" />
        </div>
      </section>

      <section id="how-it-works" className="border-y border-white/8 bg-[#0a0a0d] px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto grid max-w-6xl items-end gap-12 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <p className="eyebrow">A smaller workflow</p>
            <h2 className="mt-5 max-w-md font-display text-5xl leading-[.88] tracking-[-0.065em] sm:text-7xl">
              Start with a <span className="text-white/35 italic">link.</span>
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-3">
            {[
              ["01", "Paste", "Add the public video you want to understand."],
              ["02", "Analyze", "SoulCut finds the central story and topics."],
              ["03", "Repurpose", "Use clip notes to plan your next social cut."],
            ].map(([index, heading, body]) => (
              <article key={index} className="min-h-56 bg-[#111116] p-6 sm:p-7">
                <span className="font-mono text-[11px] tracking-[0.16em] text-[#c7ff4b]">{index}</span>
                <h3 className="mt-12 font-display text-3xl tracking-[-0.05em]">{heading}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/45">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#060608] px-5 py-24 sm:px-8 lg:py-36">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Designed for the edit</p>
              <h2 className="mt-5 font-display text-5xl tracking-[-0.065em] sm:text-7xl">A clearer first cut.</h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/45">A focused analysis flow keeps each piece of insight easy to reuse in a creative brief, script, or edit plan.</p>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, kicker, title, body }, index) => (
              <article key={kicker} className={`feature-card feature-card--${index} group min-h-80 rounded-3xl p-6 sm:p-7`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white/80">
                  <Icon size={20} />
                </span>
                <p className="mt-16 text-xs font-medium uppercase tracking-[0.15em] text-white/43">{kicker}</p>
                <h3 className="mt-3 max-w-xs font-display text-3xl leading-[.95] tracking-[-0.055em]">{title}</h3>
                <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/50">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="method" className="px-5 pb-6 sm:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#16151d] px-7 py-16 sm:px-14 sm:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(199,255,75,.14),transparent_25%),radial-gradient(circle_at_20%_100%,rgba(150,107,255,.18),transparent_32%)]" />
          <div className="relative grid items-end gap-10 md:grid-cols-[1.15fr_.85fr]">
            <div>
              <p className="eyebrow text-white/60">Your analysis room</p>
              <h2 className="mt-5 max-w-2xl font-display text-5xl leading-[.87] tracking-[-0.065em] sm:text-7xl">Less scrubbing. <span className="italic text-white/40">More making.</span></h2>
            </div>
            <div className="md:justify-self-end">
              <p className="max-w-xs text-sm leading-relaxed text-white/55">Your video links, summaries, and outputs stay organized behind your secure workspace.</p>
              <button type="button" onClick={openWorkspace} className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#c7ff4b] active:scale-[0.97]">
                Open SoulCut <Sparkles size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-display text-base tracking-[-0.04em] text-white/60">SoulCut</span>
        <span>Video analysis for better short-form decisions.</span>
      </footer>
    </main>
  );
}
