import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { type AnalysisProgressEvent, type AnalysisProgressStage, useAnalysisProgress } from "@/hooks/useAnalysisProgress";
import { filterJobHistory, getVisibleHistorySelection, type HistoryFilter } from "@/lib/jobHistory";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  History,
  Link2,
  LoaderCircle,
  LogOut,
  Play,
  Scissors,
  Send,
  Share2,
  Sparkles,
  Tag,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type Clip = {
  startSeconds: number;
  endSeconds: number;
  title: string;
  hook: string;
  reason: string;
};

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function clipText(clip: Clip) {
  return `${clip.title} (${formatTime(clip.startSeconds)}–${formatTime(clip.endSeconds)})\n${clip.hook}\nWhy this works: ${clip.reason}`;
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("Copy was unavailable in this browser.");
  }
}

async function shareText(title: string, text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  await copyText(text, "Copied to clipboard instead.");
}

function StatusPill({ status }: { status: "pending" | "processing" | "done" | "failed" }) {
  const label = status === "done" ? "Ready" : status === "processing" ? "Analyzing" : status === "failed" ? "Needs attention" : "Queued";
  return (
    <span className={`status-pill status-pill--${status}`}>
      {status === "processing" && <LoaderCircle size={12} className="animate-spin" />}
      {status === "done" && <Check size={12} />}
      {label}
    </span>
  );
}

const progressStageOrder: AnalysisProgressStage[] = ["reading", "analyzing", "clips"];
const historyFilterOptions: Array<{ value: HistoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "done", label: "Successful" },
  { value: "failed", label: "Failed" },
];

function AnalysisLoadingCard({
  progress,
  isConnected,
  hasStreamError,
}: {
  progress: AnalysisProgressEvent | null;
  isConnected: boolean;
  hasStreamError: boolean;
}) {
  const stages = [
    ["01", "reading", "Reading source", "Gathering public context"],
    ["02", "analyzing", "Finding signal", "Mapping topics and story"],
    ["03", "clips", "Shaping clips", "Flagging cut-worthy moments"],
  ];
  const currentStageIndex = progress ? progressStageOrder.indexOf(progress.stage) : -1;
  const liveMessage = progress?.message ?? "Opening a live connection to the analysis server.";

  return (
    <section className="analysis-loader mt-5 overflow-hidden rounded-3xl border border-[#c7ff4b]/20 bg-[#10150e] p-5 sm:p-7" role="status" aria-live="polite" aria-label="SoulCut is analyzing the video">
      <div className="analysis-loader__glow" aria-hidden="true" />
      <div className="relative grid gap-6 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-center">
        <div className="analysis-orb mx-auto lg:mx-0" aria-hidden="true">
          <div className="analysis-orb__ring analysis-orb__ring--outer" />
          <div className="analysis-orb__ring analysis-orb__ring--inner" />
          <div className="analysis-orb__core"><Sparkles size={20} /></div>
          <span className="analysis-orb__node analysis-orb__node--one" />
          <span className="analysis-orb__node analysis-orb__node--two" />
          <span className="analysis-orb__node analysis-orb__node--three" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow text-[#d8ff83]">SoulCut is at work</span>
            <span className="analysis-loader__live"><span /> {isConnected ? "Live analysis" : "Connecting"}</span>
          </div>
          <h2 className="mt-3 font-display text-3xl tracking-[-.055em] text-white sm:text-4xl">Turning the long cut into its <span className="italic text-white/50">best moments.</span></h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/53" aria-live="polite">{liveMessage}</p>
          {hasStreamError && <p className="mt-2 text-xs text-white/35">Live updates briefly paused; SoulCut will continue processing and refresh the completed brief when ready.</p>}
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {stages.map(([number, stage, title, detail], index) => {
              const stageIndex = progressStageOrder.indexOf(stage as AnalysisProgressStage);
              const isCurrent = stage === progress?.stage;
              const isComplete = currentStageIndex > stageIndex || progress?.stage === "complete";
              return (
              <div key={number} className={`analysis-stage rounded-2xl p-3.5 ${isCurrent ? "analysis-stage--current" : ""} ${isComplete ? "analysis-stage--complete" : ""}`} style={{ "--stage-delay": `${index * 220}ms` } as CSSProperties}>
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] tracking-[.14em] text-[#c7ff4b]">{number}</span><span className="analysis-stage__pulse" /></div>
                <p className="mt-5 text-sm font-medium text-white/84">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/38">{detail}</p>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

const timelineLabels: Record<AnalysisProgressStage, string> = {
  queued: "Queued",
  reading: "Reading source",
  analyzing: "Finding signal",
  clips: "Shaping clips",
  complete: "Brief ready",
  failed: "Stopped",
};

function CompletedJobTimeline({
  events,
  isLoading,
}: {
  events: Array<Omit<AnalysisProgressEvent, "createdAt"> & { createdAt: Date | string }> | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p className="mt-5 text-sm text-white/40">Loading the recorded analysis stages…</p>;
  }

  if (!events?.length) {
    return <p className="mt-5 rounded-2xl border border-dashed border-white/12 p-4 text-sm leading-relaxed text-white/42">This saved brief does not have a stage history. New SoulCut analyses record each processing step here.</p>;
  }

  return (
    <ol className="timeline-list mt-6 space-y-0">
      {events.map((event, index) => (
        <li key={event.id} className="timeline-list__item relative grid grid-cols-[1.6rem_minmax(0,1fr)_auto] gap-3 pb-5 last:pb-0">
          <span className={`timeline-list__marker timeline-list__marker--${event.stage}`} aria-hidden="true">{index + 1}</span>
          <div className="min-w-0 pb-1">
            <p className="text-sm font-medium text-white/83">{timelineLabels[event.stage]}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/43">{event.message}</p>
          </div>
          <time className="pt-0.5 text-right font-mono text-[10px] text-white/30" dateTime={new Date(event.createdAt).toISOString()}>
            {new Date(event.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </time>
        </li>
      ))}
    </ol>
  );
}

export default function Workspace() {
  const [, setLocation] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const [videoUrl, setVideoUrl] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copiedClip, setCopiedClip] = useState<number | null>(null);
  const [pendingFromLandingLoaded, setPendingFromLandingLoaded] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [timelineJobId, setTimelineJobId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const jobsQuery = trpc.videoJobs.list.useQuery(undefined, { enabled: isAuthenticated });
  const createJob = trpc.videoJobs.create.useMutation();
  const runJob = trpc.videoJobs.run.useMutation();
  const exportCsv = trpc.videoJobs.exportCsv.useMutation();
  const progress = useAnalysisProgress(processingJobId);
  const timelineInput = useMemo(() => (timelineJobId ? { id: timelineJobId } : { id: "__inactive__" }), [timelineJobId]);
  const timelineQuery = trpc.videoJobs.timeline.useQuery(timelineInput, {
    enabled: Boolean(timelineJobId),
    refetchOnWindowFocus: false,
  });

  const jobs = jobsQuery.data ?? [];
  const filteredJobs = useMemo(
    () => filterJobHistory(jobs, historyFilter),
    [historyFilter, jobs]
  );
  const visibleActiveId = useMemo(
    () => getVisibleHistorySelection(jobs, historyFilter, activeId),
    [activeId, historyFilter, jobs]
  );
  const activeJob = useMemo(
    () => filteredJobs.find((job) => job.id === visibleActiveId) ?? null,
    [filteredJobs, visibleActiveId]
  );

  useEffect(() => {
    if (!isAuthenticated || pendingFromLandingLoaded) return;
    const pendingUrl = sessionStorage.getItem("soulcut:pending-url");
    if (pendingUrl) {
      setVideoUrl(pendingUrl);
      sessionStorage.removeItem("soulcut:pending-url");
    }
    setPendingFromLandingLoaded(true);
  }, [isAuthenticated, pendingFromLandingLoaded]);

  useEffect(() => {
    if (timelineJobId && timelineJobId !== activeJob?.id) setTimelineJobId(null);
  }, [activeJob?.id, timelineJobId]);

  useEffect(() => {
    if (activeId !== visibleActiveId) setActiveId(visibleActiveId);
  }, [activeId, visibleActiveId]);

  const submitAnalysis = async () => {
    if (!videoUrl.trim()) {
      toast.error("Paste a public video URL first.");
      return;
    }
    try {
      const created = await createJob.mutateAsync({ videoUrl: videoUrl.trim() });
      setActiveId(created.id);
      setProcessingJobId(created.id);
      await utils.videoJobs.list.invalidate();
      const completed = await runJob.mutateAsync({ id: created.id });
      setActiveId(completed.id);
      await utils.videoJobs.list.invalidate();
      setVideoUrl("");
      toast.success("Your video brief is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not analyze that video.");
      await utils.videoJobs.list.invalidate();
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
    toast.success("Signed out successfully.");
  };

  const downloadHistoryCsv = async () => {
    try {
      const result = await exportCsv.mutateAsync();
      const blob = new Blob(["\ufeff", result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("Your job history CSV is downloading.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not export your history.");
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <main className="workspace-bg grid min-h-screen place-items-center px-6">
        <div className="flex items-center gap-3 text-sm text-white/55">
          <LoaderCircle className="animate-spin" size={18} />
          Opening your private analysis room…
        </div>
      </main>
    );
  }

  const isWorking = createJob.isPending || runJob.isPending;
  const activeClips = (activeJob?.clips ?? []) as Clip[];

  return (
    <main className="workspace-bg min-h-screen text-white">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#08080b]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black"><Scissors size={15} strokeWidth={2.7} /></span>
            <span className="font-display text-lg tracking-[-0.04em]">SoulCut</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden max-w-48 truncate text-xs text-white/38 sm:block">{user?.name ?? "Private workspace"}</span>
            <button onClick={handleLogout} type="button" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/62 transition hover:bg-white/10 hover:text-white active:scale-[.97]">
              <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[265px_minmax(0,1fr)] lg:py-9">
        <aside id="history" className="order-2 lg:order-1">
          <div className="sticky top-24 rounded-3xl border border-white/9 bg-white/[.025] p-3">
            <div className="flex items-center justify-between px-2 pb-3 pt-1">
              <div>
                <p className="eyebrow text-[9px]">Archive</p>
                <h2 className="mt-1 font-display text-2xl tracking-[-.05em]">Your briefs</h2>
              </div>
              <div className="flex items-center gap-1.5"><button type="button" onClick={() => void downloadHistoryCsv()} disabled={exportCsv.isPending} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[.04] px-2 py-1 text-[10px] font-medium text-white/58 transition hover:bg-white/10 hover:text-white disabled:opacity-50" title="Download job history as CSV"><Download size={12} /> {exportCsv.isPending ? "Preparing" : "CSV"}</button><span className="rounded-full bg-white/[.07] px-2 py-1 font-mono text-[10px] text-white/45">{filteredJobs.length}/{jobs.length}</span></div>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-white/8 bg-black/20 p-1" role="group" aria-label="Filter job history">
              {historyFilterOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHistoryFilter(option.value)}
                  aria-pressed={historyFilter === option.value}
                  className={`rounded-lg px-1 py-1.5 text-[10px] font-medium transition ${historyFilter === option.value ? "bg-white text-black shadow-sm" : "text-white/45 hover:bg-white/[.07] hover:text-white"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="max-h-[calc(100vh-12rem)] space-y-1 overflow-y-auto pr-0.5">
              {jobsQuery.isLoading && <p className="px-2 py-5 text-xs text-white/38">Loading your archive…</p>}
              {!jobsQuery.isLoading && jobs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-xs leading-relaxed text-white/38">Your completed video briefs will live here.</div>
              )}
              {!jobsQuery.isLoading && jobs.length > 0 && filteredJobs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-xs leading-relaxed text-white/38">No {historyFilter === "done" ? "successful" : "failed"} runs yet. Switch filters to review the rest of your archive.</div>
              )}
              {filteredJobs.map((job) => (
                <button
                  type="button"
                  key={job.id}
                  onClick={() => setActiveId(job.id)}
                  className={`group w-full rounded-2xl px-3 py-3 text-left transition ${activeJob?.id === job.id ? "bg-white/[.09]" : "hover:bg-white/[.045]"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-xs font-medium leading-relaxed text-white/78">{job.videoTitle ?? new URL(job.videoUrl).hostname.replace("www.", "")}</p>
                    <ChevronRight size={14} className="mt-0.5 shrink-0 text-white/23 transition group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusPill status={job.status} />
                    <span className="text-[10px] text-white/28">{new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="order-1 min-w-0 lg:order-2">
          <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Video intelligence / 01</p>
              <h1 className="mt-3 font-display text-5xl leading-[.86] tracking-[-.07em] sm:text-7xl">The cut starts <span className="text-white/35 italic">here.</span></h1>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/42">Submit a public video, then use the brief and selective clip notes to start a better edit.</p>
          </div>

          <section className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#121218] p-4 shadow-[0_22px_60px_rgba(0,0,0,.2)] sm:p-5">
            <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-[#c7ff4b]/[.08] blur-3xl" />
            <div className="relative flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/8 bg-black/20 px-3.5 py-3">
                <Link2 size={18} className="shrink-0 text-white/35" />
                <input
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isWorking) void submitAnalysis();
                  }}
                  aria-label="Public video URL to analyze"
                  placeholder="Paste a public video URL"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                  disabled={isWorking}
                />
              </div>
              <button
                type="button"
                onClick={() => void submitAnalysis()}
                disabled={isWorking}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#e9ffe2] px-5 py-3.5 text-sm font-semibold text-[#111710] transition hover:bg-[#c7ff4b] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[.97]"
              >
                {isWorking ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />}
                {isWorking ? "Analyzing…" : "Create brief"}
              </button>
            </div>
            <p className="relative mt-3 px-1 text-xs text-white/32">SoulCut only analyzes public sources it can access. Recommendations remain grounded in available video context.</p>
          </section>

          {isWorking && <AnalysisLoadingCard progress={progress.latestEvent} isConnected={progress.isConnected} hasStreamError={progress.hasStreamError} />}

          {activeJob && !isWorking && (
            <section className="mt-5 space-y-5">
              <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/9 bg-white/[.025] p-5 sm:flex-row sm:items-start sm:p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5"><StatusPill status={activeJob.status} /><span className="font-mono text-[10px] uppercase tracking-[.14em] text-white/32">{activeJob.model ?? "Video research"}</span></div>
                  <p className="mt-4 break-all text-sm leading-relaxed text-white/65">{activeJob.videoUrl}</p>
                </div>
                <a href={activeJob.videoUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-xs text-white/60 transition hover:bg-white/8 hover:text-white"><ExternalLink size={13} /> Source</a>
              </div>

              {activeJob.status === "failed" && (
                <div className="rounded-3xl border border-red-400/20 bg-red-400/[.07] p-6">
                  <p className="font-display text-2xl tracking-[-.045em] text-red-100">This source couldn’t be analyzed.</p>
                  <p className="mt-2 text-sm leading-relaxed text-red-100/55">{activeJob.failureReason ?? "Confirm that the source is public and try another URL."}</p>
                </div>
              )}

              {activeJob.status === "done" && activeJob.summary && (
                <>
                  <article className="result-card result-card--summary rounded-3xl p-6 sm:p-8">
                    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                      <div><p className="eyebrow text-white/50">The brief</p><h2 className="mt-3 font-display text-4xl tracking-[-.06em]">What it says.</h2></div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void copyText(activeJob.summary!, "Brief copied.")} className="icon-button" aria-label="Copy summary"><Copy size={16} /></button>
                        <button type="button" onClick={() => void shareText("SoulCut brief", activeJob.summary!)} className="icon-button" aria-label="Share summary"><Share2 size={16} /></button>
                      </div>
                    </div>
                    <p className="mt-8 max-w-3xl text-base leading-8 text-white/72 sm:text-lg">{activeJob.summary}</p>
                    {activeJob.topics && activeJob.topics.length > 0 && (
                      <div className="mt-7 flex flex-wrap gap-2">
                        {activeJob.topics.map((topic) => <span key={topic} className="topic-chip"><Tag size={12} /> {topic}</span>)}
                      </div>
                    )}
                  </article>

                  <article className="rounded-3xl border border-white/9 bg-[#101015] p-6 sm:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div><p className="eyebrow">The short list</p><h2 className="mt-3 font-display text-4xl tracking-[-.06em]">Moments to pull.</h2></div>
                      {activeClips.length > 0 && <button type="button" onClick={() => void copyText(activeClips.map(clipText).join("\n\n"), "All clip notes copied.")} className="inline-flex items-center gap-2 text-xs text-white/52 transition hover:text-white"><Copy size={14} /> Copy all</button>}
                    </div>
                    {activeClips.length > 0 ? (
                      <div className="mt-7 grid gap-3">
                        {activeClips.map((clip, index) => (
                          <article key={`${clip.startSeconds}-${clip.endSeconds}-${clip.title}`} className="clip-card group rounded-2xl p-4 sm:p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 gap-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black"><Play size={16} fill="currentColor" /></span>
                                <div className="min-w-0"><p className="font-mono text-[11px] tracking-[.12em] text-[#c7ff4b]">{formatTime(clip.startSeconds)} — {formatTime(clip.endSeconds)}</p><h3 className="mt-1 font-display text-2xl tracking-[-.045em] text-white">{clip.title}</h3><p className="mt-2 text-sm leading-relaxed text-white/52">“{clip.hook}”</p></div>
                              </div>
                              <div className="flex shrink-0 gap-2 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                                <button type="button" className="icon-button" aria-label="Copy clip note" onClick={() => { void copyText(clipText(clip), "Clip note copied."); setCopiedClip(index); window.setTimeout(() => setCopiedClip(null), 1400); }}>{copiedClip === index ? <Check size={16} /> : <Copy size={16} />}</button>
                                <button type="button" className="icon-button" aria-label="Share clip note" onClick={() => void shareText("SoulCut clip idea", clipText(clip))}><Share2 size={16} /></button>
                              </div>
                            </div>
                            <p className="mt-4 border-t border-white/8 pt-3 text-xs leading-relaxed text-white/38"><span className="text-white/60">Why this moment:</span> {clip.reason}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-7 rounded-2xl border border-dashed border-white/12 p-5 text-sm leading-relaxed text-white/44">No timestamp suggestions were returned because reliable public timing context was not available for this source. The video brief and topics are still ready to use.</div>
                    )}
                  </article>
                  <article className="overflow-hidden rounded-3xl border border-white/9 bg-white/[.025]">
                    <button
                      type="button"
                      onClick={() => setTimelineJobId(timelineJobId === activeJob.id ? null : activeJob.id)}
                      aria-expanded={timelineJobId === activeJob.id}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/[.035] sm:p-6"
                    >
                      <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20 text-[#c7ff4b]"><History size={18} /></span><span><span className="eyebrow text-[9px]">Recorded process</span><span className="mt-1 block font-display text-2xl tracking-[-.045em] text-white">View stage timeline</span></span></span>
                      <ChevronRight size={18} className={`shrink-0 text-white/40 transition-transform ${timelineJobId === activeJob.id ? "rotate-90" : ""}`} />
                    </button>
                    {timelineJobId === activeJob.id && <div className="border-t border-white/8 px-5 pb-5 sm:px-6 sm:pb-6"><CompletedJobTimeline events={timelineQuery.data} isLoading={timelineQuery.isLoading} /></div>}
                  </article>
                  {activeJob.sourceNote && <p className="px-2 text-xs leading-relaxed text-white/32"><span className="font-medium text-white/48">Analysis note:</span> {activeJob.sourceNote}</p>}
                </>
              )}
            </section>
          )}

          {!activeJob && !isWorking && (
            <section className="mt-5 grid min-h-[320px] place-items-center rounded-[1.8rem] border border-dashed border-white/12 bg-white/[.018] p-7 text-center">
              <div className="max-w-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[.07] text-white/65"><FileText size={21} /></span><h2 className="mt-5 font-display text-3xl tracking-[-.05em]">Your next brief begins above.</h2><p className="mt-3 text-sm leading-relaxed text-white/43">Add a public video URL to bring its central story, topics, and repurposing notes into focus.</p></div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
