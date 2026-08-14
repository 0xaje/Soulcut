import { ThemeToggle } from "@/components/ThemeToggle";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { MindEvidenceDetails } from "@/components/MindEvidenceDetails";
import { type AnalysisProgressEvent, type AnalysisProgressStage, useAnalysisProgress } from "@/hooks/useAnalysisProgress";
import { filterJobHistory, getVisibleHistorySelection, type HistoryFilter } from "@/lib/jobHistory";
import { groupMindActivityByRecency } from "@/lib/mindPresentation";
import { trpc } from "@/lib/trpc";
import {
  Archive,
  ArrowLeft,
  Brain,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  History,
  Link2,
  LoaderCircle,
  LogOut,
  Network,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  Send,
  Share2,
  Sparkles,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type Clip = {
  startSeconds: number;
  endSeconds: number;
  title: string;
  hook: string;
  reason: string;
};

type FeedbackReason = "too_slow" | "wrong_tone" | "wrong_hook" | "too_generic" | "too_much_text" | "not_my_audience" | "other";

const feedbackReasonOptions: Array<{ value: FeedbackReason; label: string }> = [
  { value: "too_slow", label: "Too slow" },
  { value: "wrong_tone", label: "Wrong tone" },
  { value: "too_generic", label: "Too generic" },
  { value: "wrong_hook", label: "Wrong hook" },
  { value: "too_much_text", label: "Too much text" },
  { value: "not_my_audience", label: "Not for my audience" },
  { value: "other", label: "Other" },
];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Transcript file could not be read."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Transcript file could not be read."));
    reader.readAsDataURL(file);
  });
}

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

function StatusPill({ status }: { status: "pending" | "processing" | "retrying" | "done" | "failed" | "cancelled" }) {
  const label = status === "done" ? "Ready" : status === "processing" ? "Analyzing" : status === "retrying" ? "Retrying" : status === "failed" ? "Needs attention" : status === "cancelled" ? "Cancelled" : "Queued";
  return (
    <span className={`status-pill status-pill--${status}`}>
      {(status === "processing" || status === "retrying") && <LoaderCircle size={12} className="animate-spin" />}
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

function formatShareExpiry(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown expiry";
  return `Expires ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

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
    ["01", "reading", "Understanding the story", "Reading your content and available grounded source context"],
    ["02", "analyzing", "Mind at work", "Checking your Creative DNA and applying what it has learned"],
    ["03", "clips", "Preparing creative opportunities", "Finding grounded moments that fit your style"],
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
          <h2 className="mt-3 font-display text-3xl tracking-[-.055em] text-white sm:text-4xl">Your Mind is at work—<span className="italic text-white/50">finding moments that fit.</span></h2>
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
  retrying: "Retry scheduled",
  complete: "Brief ready",
  failed: "Stopped",
  cancelled: "Cancelled",
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
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copiedClip, setCopiedClip] = useState<number | null>(null);
  const [pendingFromLandingLoaded, setPendingFromLandingLoaded] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [timelineJobId, setTimelineJobId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [shareExpiryHours, setShareExpiryHours] = useState(24 * 7);
  const [reportSettingsOpen, setReportSettingsOpen] = useState(false);
  const [coverTitleInput, setCoverTitleInput] = useState("");
  const [mindPanelOpen, setMindPanelOpen] = useState(false);
  const [showMindOnboarding, setShowMindOnboarding] = useState(false);
  const [onboardingVoice, setOnboardingVoice] = useState<string[]>([]);
  const [onboardingHooks, setOnboardingHooks] = useState<string[]>([]);
  const [onboardingPacing, setOnboardingPacing] = useState<string[]>([]);
  const [onboardingAudience, setOnboardingAudience] = useState("");
  const [onboardingNotes, setOnboardingNotes] = useState("");
  const [teachMindInput, setTeachMindInput] = useState("");
  const [selectedMemoryId, setSelectedMemoryId] = useState<number | null>(null);
  const [expandedExplanation, setExpandedExplanation] = useState<number | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<number | null>(null);
  const [feedbackReason, setFeedbackReason] = useState<FeedbackReason>("too_slow");
  const [feedbackText, setFeedbackText] = useState("");
  const listFilters = useMemo(() => ({
    includeArchived,
    search: historySearch.trim() || undefined,
    startDate: historyStartDate || undefined,
    endDate: historyEndDate || undefined,
  }), [historyEndDate, historySearch, historyStartDate, includeArchived]);
  const jobsQuery = trpc.videoJobs.list.useQuery(listFilters, { enabled: isAuthenticated });
  const createJob = trpc.videoJobs.create.useMutation();
  const createJobWithTranscript = trpc.videoJobs.createWithTranscript.useMutation();
  const runJob = trpc.videoJobs.run.useMutation();
  const archiveJob = trpc.videoJobs.archive.useMutation();
  const restoreJob = trpc.videoJobs.restore.useMutation();
  const cancelJob = trpc.videoJobs.cancel.useMutation();
  const deleteJob = trpc.videoJobs.delete.useMutation();
  const exportCsv = trpc.videoJobs.exportCsv.useMutation();
  const exportPdf = trpc.videoJobs.exportPdf.useMutation();
  const createPdfShare = trpc.videoJobs.createPdfShare.useMutation();
  const revokePdfShare = trpc.videoJobs.revokePdfShare.useMutation();
  const setPdfCoverTitle = trpc.videoJobs.setPdfCoverTitle.useMutation();
  const uploadPdfLogo = trpc.videoJobs.uploadPdfLogo.useMutation();
  const pdfSharesQuery = trpc.videoJobs.listPdfShares.useQuery(undefined, { enabled: isAuthenticated && reportSettingsOpen });
  const pdfBrandingQuery = trpc.videoJobs.getPdfBranding.useQuery(undefined, { enabled: isAuthenticated && reportSettingsOpen });
  const mindQuery = trpc.mind.getMind.useQuery(undefined, { enabled: isAuthenticated });
  const creativeDnaQuery = trpc.mind.getCreativeDNA.useQuery(undefined, { enabled: isAuthenticated });
  const mindActivityQuery = trpc.mind.getMindActivity.useQuery({ limit: 6 }, { enabled: isAuthenticated });
  const personalizedInput = useMemo(() => (activeId ? { jobId: activeId } : { jobId: "__inactive__" }), [activeId]);
  const personalizedQuery = trpc.mind.getPersonalizedRecommendations.useQuery(personalizedInput, { enabled: isAuthenticated && Boolean(activeId) });
  const evidenceInput = useMemo(() => ({ memoryId: selectedMemoryId ?? 1 }), [selectedMemoryId]);
  const preferenceEvidenceQuery = trpc.mind.getPreferenceEvidence.useQuery(evidenceInput, { enabled: isAuthenticated && selectedMemoryId !== null });
  const completeMindOnboarding = trpc.mind.completeOnboarding.useMutation();
  const teachMind = trpc.mind.teachMind.useMutation();
  const submitMindFeedback = trpc.mind.submitFeedback.useMutation();
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
  const activityGroups = useMemo(() => groupMindActivityByRecency(mindActivityQuery.data ?? []), [mindActivityQuery.data]);

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

  useEffect(() => {
    if (pdfBrandingQuery.data?.coverTitle) setCoverTitleInput(pdfBrandingQuery.data.coverTitle);
  }, [pdfBrandingQuery.data?.coverTitle]);

  useEffect(() => {
    if (mindQuery.data && !mindQuery.data.mind.onboardedAt) setShowMindOnboarding(true);
  }, [mindQuery.data]);

  useEffect(() => {
    const stage = progress.latestEvent?.stage;
    if (!processingJobId || !stage || !["complete", "failed", "cancelled"].includes(stage)) return;
    setProcessingJobId(null);
    void utils.videoJobs.list.invalidate();
    toast[stage === "complete" ? "success" : "message"](
      stage === "complete" ? "Your video brief is ready." : stage === "cancelled" ? "Analysis cancelled." : "Analysis stopped after its final attempt."
    );
  }, [processingJobId, progress.latestEvent?.id, progress.latestEvent?.stage, utils.videoJobs.list]);

  const submitAnalysis = async () => {
    if (!videoUrl.trim()) {
      toast.error("Paste a public video URL first.");
      return;
    }
    try {
      const created = transcriptFile
        ? await createJobWithTranscript.mutateAsync({
          videoUrl: videoUrl.trim(),
          filename: transcriptFile.name,
          mimeType: transcriptFile.type || undefined,
          dataUrl: await readFileAsDataUrl(transcriptFile),
        })
        : await createJob.mutateAsync({ videoUrl: videoUrl.trim() });
      setActiveId(created.id);
      setProcessingJobId(created.id);
      await utils.videoJobs.list.invalidate();
      setVideoUrl("");
      setTranscriptFile(null);
      if (transcriptInputRef.current) transcriptInputRef.current.value = "";
      toast.success(transcriptFile ? "Transcript-backed analysis queued. We’ll update this brief as the worker progresses." : "Analysis queued. We’ll update this brief as the worker progresses.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not analyze that video.");
      await utils.videoJobs.list.invalidate();
      setProcessingJobId(null);
    }
  };

  const toggleOnboardingOption = (value: string, current: string[], setCurrent: (next: string[]) => void) => {
    setCurrent(current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  };

  const refreshMindData = async () => {
    await Promise.all([
      utils.mind.getMind.invalidate(),
      utils.mind.getCreativeDNA.invalidate(),
      utils.mind.getMindActivity.invalidate(),
      utils.mind.getMindStats.invalidate(),
      utils.mind.getPersonalizedRecommendations.invalidate(),
    ]);
  };

  const saveMindOnboarding = async () => {
    try {
      await completeMindOnboarding.mutateAsync({
        voice: onboardingVoice,
        hooks: onboardingHooks,
        pacing: onboardingPacing,
        audience: onboardingAudience.trim() || undefined,
        notes: onboardingNotes.trim() || undefined,
      });
      setShowMindOnboarding(false);
      await refreshMindData();
      toast.success("Your Creative Mind is ready to learn with you.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not initialize your Mind.");
    }
  };

  const saveTeaching = async () => {
    if (!teachMindInput.trim()) return;
    try {
      const result = await teachMind.mutateAsync({ lesson: teachMindInput.trim() });
      setTeachMindInput("");
      await refreshMindData();
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not update your Mind.");
    }
  };

  const recordRecommendationFeedback = async (index: number, feedbackType: "keep" | "not_my_style", details: { reason?: FeedbackReason; feedbackText?: string } = {}) => {
    if (!activeJob) return;
    try {
      const result = await submitMindFeedback.mutateAsync({
        jobId: activeJob.id,
        recommendationId: `clip-${index + 1}`,
        feedbackType,
        reason: details.reason,
        feedbackText: details.feedbackText?.trim() || undefined,
      });
      await refreshMindData();
      setFeedbackTarget(null);
      setFeedbackReason("too_slow");
      setFeedbackText("");
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not record that feedback.");
    }
  };

  const archiveSelectedJob = async (jobId: string) => {
    try {
      await archiveJob.mutateAsync({ id: jobId });
      if (activeId === jobId) setActiveId(null);
      await utils.videoJobs.list.invalidate();
      toast.success("Brief archived. Turn on “Show archived” to view it again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not archive that brief.");
    }
  };

  const cancelSelectedJob = async (jobId: string) => {
    if (!window.confirm("Cancel this analysis? Any completed work already saved will remain unavailable.")) return;
    try {
      await cancelJob.mutateAsync({ id: jobId });
      if (processingJobId === jobId) setProcessingJobId(null);
      await utils.videoJobs.list.invalidate();
      toast.success("Analysis cancelled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not cancel that analysis.");
    }
  };

  const restoreSelectedJob = async (jobId: string) => {
    try {
      await restoreJob.mutateAsync({ id: jobId });
      await utils.videoJobs.list.invalidate();
      toast.success("Brief restored to your active history.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not restore that brief.");
    }
  };

  const deleteSelectedJob = async (jobId: string) => {
    if (!window.confirm("Permanently delete this brief and its timeline? This action cannot be undone.")) return;
    try {
      await deleteJob.mutateAsync({ id: jobId });
      if (activeId === jobId) setActiveId(null);
      await utils.videoJobs.list.invalidate();
      toast.success("Brief permanently deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not delete that brief.");
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

  const downloadJobPdf = async (jobId: string) => {
    try {
      const result = await exportPdf.mutateAsync({ id: jobId });
      const binary = window.atob(result.base64);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("Your formatted report is downloading.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not create that PDF report.");
    }
  };

  const shareJobPdf = async (jobId: string) => {
    try {
      const result = await createPdfShare.mutateAsync({ id: jobId, expiresInHours: shareExpiryHours });
      const shareUrl = `${window.location.origin}${result.sharePath}`;
      await copyText(shareUrl, `Shareable report link copied. ${formatShareExpiry(result.expiresAt)}`);
      await utils.videoJobs.listPdfShares.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not create a share link.");
    }
  };

  const revokeShareLink = async (token: string) => {
    try {
      await revokePdfShare.mutateAsync({ token });
      await utils.videoJobs.listPdfShares.invalidate();
      toast.success("Share link revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not revoke that link.");
    }
  };

  const saveCoverTitle = async () => {
    try {
      const result = await setPdfCoverTitle.mutateAsync({ coverTitle: coverTitleInput.trim() });
      setCoverTitleInput(result.coverTitle);
      await utils.videoJobs.getPdfBranding.invalidate();
      toast.success("Report cover title updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not update the cover title.");
    }
  };

  const uploadCoverLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!/image\/(png|jpeg)/.test(file.type) || file.size > 2_000_000) {
      toast.error("Choose a PNG or JPEG logo smaller than 2 MB.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Logo file could not be read."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      await uploadPdfLogo.mutateAsync({ dataUrl });
      await utils.videoJobs.getPdfBranding.invalidate();
      toast.success("Report logo uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not upload that logo.");
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

  const isWorking = createJob.isPending || createJobWithTranscript.isPending || runJob.isPending || Boolean(processingJobId);
  const activeClips = (activeJob?.clips ?? []) as Clip[];
  const appliedMindPreferences = activeJob?.mindContextSnapshot?.preferences ?? [];
  const hasMindOnboardingInput = onboardingVoice.length + onboardingHooks.length + onboardingPacing.length > 0 || Boolean(onboardingAudience.trim()) || Boolean(onboardingNotes.trim());

  return (
    <main className="workspace-bg min-h-screen text-white">
      {showMindOnboarding && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#050507]/90 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="mind-onboarding-title">
          <section className="my-8 w-full max-w-3xl rounded-[2rem] border border-[#c7ff4b]/25 bg-[#101014] p-5 shadow-[0_30px_120px_rgba(0,0,0,.65)] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="eyebrow text-[#d8ff83]">Meet your SoulCut Mind</p><h1 id="mind-onboarding-title" className="mt-2.5 font-display text-3xl leading-[1.08] tracking-[-.04em] sm:text-4xl">Teach it once.<br /><span className="italic text-white/40">It remembers.</span></h1></div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#c7ff4b]/20 bg-[#c7ff4b]/10 text-[#d8ff83]"><Brain size={21} /></span>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/55">Your Creative Mind learns the choices you make, the style you prefer, and what you want it to avoid. Start with a few useful signals—never a long form.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {[
                ["Voice", ["Conversational", "Direct", "Educational", "Humorous", "Energetic", "Professional"], onboardingVoice, setOnboardingVoice],
                ["Hooks", ["Questions", "Bold statements", "Curiosity", "Contrarian", "Story-first", "Problem-first"], onboardingHooks, setOnboardingHooks],
                ["Editing", ["Fast", "Balanced", "Calm", "Cinematic", "Raw", "Minimal"], onboardingPacing, setOnboardingPacing],
              ].map(([title, options, selected, setter]) => <div key={title as string}><p className="text-xs font-medium uppercase tracking-[.14em] text-white/45">{title as string}</p><div className="mt-3 flex flex-wrap gap-2">{(options as string[]).map(option => <button key={option} type="button" onClick={() => toggleOnboardingOption(option, selected as string[], setter as (next: string[]) => void)} aria-pressed={(selected as string[]).includes(option)} className={`rounded-full border px-3 py-1.5 text-xs transition ${(selected as string[]).includes(option) ? "border-[#c7ff4b]/60 bg-[#c7ff4b]/12 text-[#e1ff9f]" : "border-white/10 bg-white/[.035] text-white/55 hover:border-white/25 hover:text-white"}`}>{option}</button>)}</div></div>)}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-white/50">Who are you creating for?<input value={onboardingAudience} onChange={event => setOnboardingAudience(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#c7ff4b]/55" placeholder="e.g. first-time founders" /></label>
              <label className="text-xs text-white/50">Anything your Mind should know?<textarea value={onboardingNotes} onChange={event => setOnboardingNotes(event.target.value)} className="mt-2 min-h-20 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#c7ff4b]/55" placeholder="e.g. Avoid corporate language and emojis." /></label>
            </div>
            <div className="mt-7 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setShowMindOnboarding(false)} className="rounded-full px-4 py-2.5 text-sm text-white/50 transition hover:text-white">Explore first</button><button type="button" onClick={() => void saveMindOnboarding()} disabled={completeMindOnboarding.isPending || !hasMindOnboardingInput} className="inline-flex items-center gap-2 rounded-full bg-[#e9ffe2] px-5 py-2.5 text-sm font-semibold text-[#111710] transition hover:bg-[#c7ff4b] disabled:opacity-50"><Brain size={15} /> {completeMindOnboarding.isPending ? "Teaching…" : "Teach my Mind"}</button></div>
          </section>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#08080b]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black"><Scissors size={15} strokeWidth={2.7} /></span>
            <span className="font-display text-lg tracking-[-0.04em]">SoulCut</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dna" className="hidden rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/55 transition hover:border-[#c7ff4b]/45 hover:text-[#d8ff83] sm:block">Creative DNA</Link>
            <Link href="/evolution" className="hidden rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-white/55 transition hover:border-[#c7ff4b]/45 hover:text-[#d8ff83] lg:block">Evolution</Link>
            <Link href="/walkthrough" className="hidden rounded-full border border-[#c7ff4b]/20 bg-[#c7ff4b]/[.07] px-3 py-2 text-xs text-[#d8ff83] transition hover:bg-[#c7ff4b]/14 xl:block">Walkthrough</Link>
            <ThemeToggle />
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
                <p className="eyebrow text-[9px]">Creative evolution</p>
                <h2 className="mt-1 font-display text-2xl tracking-[-.05em]">Your briefs</h2>
                <p className="mt-1 text-[10px] text-white/35">{jobs.length} videos · {creativeDnaQuery.data?.stats.preferenceCount ?? 0} preferences learned</p>
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
            <div className="mb-3 space-y-2 border-b border-white/8 pb-3">
              <label className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-2.5 py-2 text-white/45 focus-within:border-[#c7ff4b]/55" htmlFor="history-search">
                <Search size={13} aria-hidden="true" />
                <input id="history-search" value={historySearch} onChange={event => setHistorySearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/28" placeholder="Search source URL" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[9px] uppercase tracking-[.1em] text-white/35">From<input type="date" value={historyStartDate} onChange={event => setHistoryStartDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/8 bg-black/20 px-2 py-1.5 text-[10px] text-white/70 outline-none focus:border-[#c7ff4b]/55" /></label>
                <label className="text-[9px] uppercase tracking-[.1em] text-white/35">To<input type="date" value={historyEndDate} onChange={event => setHistoryEndDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/8 bg-black/20 px-2 py-1.5 text-[10px] text-white/70 outline-none focus:border-[#c7ff4b]/55" /></label>
              </div>
              <label className="flex items-center gap-2 px-1 text-[10px] text-white/46"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} className="accent-[#c7ff4b]" /> Show archived briefs</label>
            </div>
            <div className="max-h-[calc(100vh-12rem)] space-y-1 overflow-y-auto pr-0.5">
              {jobsQuery.isLoading && <p className="px-2 py-5 text-xs text-white/38">Loading your archive…</p>}
              {!jobsQuery.isLoading && jobs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-xs leading-relaxed text-white/38">Your completed video briefs will live here.</div>
              )}
              {!jobsQuery.isLoading && jobs.length > 0 && filteredJobs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-xs leading-relaxed text-white/38">No {historyFilter === "done" ? "successful" : "failed"} runs yet. Switch filters to review the rest of your archive.</div>
              )}
              {filteredJobs.map((job) => {
                const jobIsActive = ["pending", "processing", "retrying"].includes(job.status);
                return <div key={job.id} className={`group rounded-2xl px-3 py-3 transition ${activeJob?.id === job.id ? "bg-white/[.09]" : "hover:bg-white/[.045]"}`}>
                  <button type="button" onClick={() => setActiveId(job.id)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-xs font-medium leading-relaxed text-white/78">{job.videoTitle ?? new URL(job.videoUrl).hostname.replace("www.", "")}</p>
                      <ChevronRight size={14} className="mt-0.5 shrink-0 text-white/23 transition group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusPill status={job.status} />
                      <span className="text-[10px] text-white/28">{new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                  </button>
                  <div className="mt-2 flex justify-end gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    {jobIsActive ? <button type="button" onClick={() => void cancelSelectedJob(job.id)} disabled={cancelJob.isPending} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-amber-100/70 transition hover:bg-amber-100/10 hover:text-amber-100 disabled:opacity-50"><X size={11} /> Cancel</button> : <>{job.archivedAt ? <button type="button" onClick={() => void restoreSelectedJob(job.id)} disabled={restoreJob.isPending} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-[#d8ff83]/70 transition hover:bg-[#c7ff4b]/10 hover:text-[#d8ff83] disabled:opacity-50"><RotateCcw size={11} /> Restore</button> : <button type="button" onClick={() => void archiveSelectedJob(job.id)} disabled={archiveJob.isPending} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-white/42 transition hover:bg-white/[.08] hover:text-white disabled:opacity-50"><Archive size={11} /> Archive</button>}<button type="button" onClick={() => void deleteSelectedJob(job.id)} disabled={deleteJob.isPending} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-red-200/50 transition hover:bg-red-300/10 hover:text-red-100 disabled:opacity-50"><Trash2 size={11} /> Delete</button></>}
                  </div>
                </div>;
              })}
            </div>
            <div className="mt-3 border-t border-white/8 pt-3">
              <button type="button" onClick={() => setReportSettingsOpen(current => !current)} aria-expanded={reportSettingsOpen} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-xs text-white/56 transition hover:bg-white/[.05] hover:text-white">
                <span>Report sharing & cover</span><ChevronRight size={14} className={`transition-transform ${reportSettingsOpen ? "rotate-90" : ""}`} />
              </button>
              {reportSettingsOpen && <div className="mt-2 space-y-4 rounded-2xl border border-white/8 bg-black/20 p-3">
                <div>
                  <p className="text-xs font-medium text-white/78">Cover branding</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/38">Applied to new PDF reports.</p>
                  <label className="mt-3 block text-[10px] uppercase tracking-[.11em] text-white/42" htmlFor="cover-title">Cover title</label>
                  <input id="cover-title" value={coverTitleInput} onChange={event => setCoverTitleInput(event.target.value)} maxLength={140} className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[.045] px-3 py-2 text-xs text-white outline-none placeholder:text-white/28 focus:border-[#c7ff4b]/55" placeholder="Video Analysis Report" />
                  <button type="button" onClick={() => void saveCoverTitle()} disabled={setPdfCoverTitle.isPending || !coverTitleInput.trim()} className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-medium text-black transition hover:bg-[#c7ff4b] disabled:opacity-50">{setPdfCoverTitle.isPending ? "Saving" : "Save title"}</button>
                  <div className="mt-3 flex items-center gap-2">
                    {pdfBrandingQuery.data?.logoUrl ? <img src={pdfBrandingQuery.data.logoUrl} alt="Current report logo" className="h-9 w-9 rounded-lg border border-white/10 object-contain" /> : <span className="grid h-9 w-9 place-items-center rounded-lg border border-dashed border-white/14 text-[10px] text-white/38">Logo</span>}
                    <label className="cursor-pointer rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/65 transition hover:bg-white/[.08] hover:text-white"><input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={event => void uploadCoverLogo(event.target.files?.[0])} />{uploadPdfLogo.isPending ? "Uploading" : "Upload logo"}</label>
                  </div>
                </div>
                <div className="border-t border-white/8 pt-3">
                  <p className="text-xs font-medium text-white/78">Active share links</p>
                  <div className="mt-2 space-y-2">
                    {pdfSharesQuery.isLoading && <p className="text-[11px] text-white/38">Loading active links…</p>}
                    {!pdfSharesQuery.isLoading && !pdfSharesQuery.data?.length && <p className="text-[11px] leading-relaxed text-white/38">New share links will appear here until they expire or are revoked.</p>}
                    {pdfSharesQuery.data?.map(share => <div key={share.token} className="rounded-xl border border-white/8 bg-white/[.025] p-2.5"><p className="truncate text-[11px] text-white/70">{new URL(share.videoUrl).hostname.replace("www.", "")}</p><p className="mt-1 text-[10px] text-white/35">{share.expiresAt ? formatShareExpiry(share.expiresAt) : "No expiry"}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => void copyText(`${window.location.origin}/share/report/${share.token}`, "Shareable report link copied.")} className="text-[10px] text-[#d8ff83] hover:text-[#c7ff4b]">Copy link</button><button type="button" onClick={() => void revokeShareLink(share.token)} disabled={revokePdfShare.isPending} className="inline-flex items-center gap-1 text-[10px] text-white/45 hover:text-red-200"><X size={11} /> Revoke</button></div></div>)}
                  </div>
                </div>
              </div>}
            </div>
          </div>
        </aside>

        <section className="order-1 min-w-0 lg:order-2">
          <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-[#c7ff4b]/18 bg-[#10140f] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:p-7">
            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#c7ff4b]/[.10] blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl"><div className="flex items-center gap-2"><span className="eyebrow text-[#d8ff83]">Meet your Creative Mind</span><span className="inline-flex items-center gap-1 rounded-full border border-[#c7ff4b]/20 bg-[#c7ff4b]/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-[#d8ff83]"><CircleDot size={10} /> {mindQuery.data?.builderAvailability === "available" ? "Powered by Minds" : "Persistent memory"}</span></div><h1 className="mt-2.5 font-display text-2xl leading-[1.1] tracking-[-.04em] sm:text-4xl">SoulCut remembers <span className="italic text-white/42">how you create.</span></h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-white/54">SoulCut is your focused creative experience. Minds supplies the persistent intelligence layer; every lesson, approval, and correction becomes evidence your Mind can use for the next creative decision.</p></div>
                <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => setShowMindOnboarding(true)} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#c7ff4b]/25 bg-[#c7ff4b]/10 px-4 py-2.5 text-xs text-[#d8ff83] transition hover:bg-[#c7ff4b]/18"><Users size={14} /> Teach your Mind</button><Link href="/dna" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[.045] px-4 py-2.5 text-xs text-white/72 transition hover:border-[#c7ff4b]/45 hover:bg-[#c7ff4b]/10 hover:text-[#e1ff9f]"><Network size={14} /> Open Creative DNA</Link><Link href="/evolution" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[.045] px-4 py-2.5 text-xs text-white/72 transition hover:border-[#c7ff4b]/45 hover:bg-[#c7ff4b]/10 hover:text-[#e1ff9f]"><History size={14} /> Compare videos</Link><Link href="/walkthrough" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#c7ff4b]/20 bg-[#c7ff4b]/[.07] px-4 py-2.5 text-xs text-[#d8ff83] transition hover:bg-[#c7ff4b]/14"><CircleDot size={14} /> Judge walkthrough</Link><button type="button" onClick={() => setMindPanelOpen(current => !current)} aria-expanded={mindPanelOpen} className="rounded-full px-3 py-2.5 text-xs text-white/45 transition hover:text-white">{mindPanelOpen ? "Hide preview" : "Preview"}</button></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  ["Preferences", creativeDnaQuery.data?.stats.preferenceCount ?? 0, Brain],
                  ["Feedback signals", creativeDnaQuery.data?.stats.feedbackCount ?? 0, ThumbsUp],
                  ["Strong patterns", creativeDnaQuery.data?.stats.strongPatterns ?? 0, Network],
                  ["Avg. confidence", `${creativeDnaQuery.data?.stats.averageConfidence ?? 0}%`, CircleDot],
                ].map(([label, value, Icon]) => {
                  const StatIcon = Icon as typeof Brain;
                  return <div key={label as string} className="rounded-2xl border border-white/8 bg-black/20 p-3.5"><div className="flex items-center justify-between text-white/35"><span className="text-[10px] uppercase tracking-[.12em]">{label as string}</span><StatIcon size={13} /></div><p className="mt-3 font-display text-3xl tracking-[-.05em] text-white">{value as string | number}</p></div>;
                })}
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-3"><label className="sr-only" htmlFor="teach-mind">Teach your Mind</label><div className="flex flex-col gap-2 sm:flex-row"><input id="teach-mind" value={teachMindInput} onChange={event => setTeachMindInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void saveTeaching(); }} maxLength={500} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/30" placeholder="Teach your Mind… e.g. Keep intros under five seconds." /><button type="button" onClick={() => void saveTeaching()} disabled={teachMind.isPending || !teachMindInput.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e9ffe2] px-3.5 py-2 text-xs font-semibold text-[#111710] transition hover:bg-[#c7ff4b] disabled:opacity-50"><Plus size={14} /> {teachMind.isPending ? "Learning" : "Teach Mind"}</button></div></div>
                <div className="rounded-2xl border border-white/8 bg-black/20 px-3.5 py-3"><p className="text-[10px] uppercase tracking-[.12em] text-white/35">Latest learning</p>{mindActivityQuery.data?.[0] ? <p className="mt-2 text-xs leading-relaxed text-white/65">{mindActivityQuery.data[0].message}</p> : <p className="mt-2 text-xs leading-relaxed text-white/35">Your Mind will surface each meaningful learning event here.</p>}</div>
              </div>
              {mindPanelOpen && <div className="grid gap-4 border-t border-white/8 pt-5 lg:grid-cols-[minmax(0,1fr)_290px]">
                <div><div className="flex items-center justify-between"><p className="eyebrow text-[9px]">Creative DNA</p><span className="text-[10px] text-white/35">Evidence-backed, never assumed</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><MindEvidenceDetails memories={creativeDnaQuery.data?.memories ?? []} selectedMemoryId={selectedMemoryId} onSelectMemory={setSelectedMemoryId} onCloseEvidence={() => setSelectedMemoryId(null)} evidence={preferenceEvidenceQuery.data} isLoadingEvidence={preferenceEvidenceQuery.isLoading} /></div></div>
                <div><p className="eyebrow text-[9px]">Mind activity</p><div className="mt-3 space-y-4">{activityGroups.length ? activityGroups.map(group => <section key={group.label}><p className="font-mono text-[10px] uppercase tracking-[.12em] text-[#d8ff83]">{group.label}</p><div className="mt-2 space-y-2">{group.activity.map(activity => <div key={activity.id} className="rounded-xl border border-white/8 bg-white/[.025] p-3"><p className="text-xs text-white/72">{activity.message}</p><time className="mt-1 block text-[10px] text-white/30">{new Date(activity.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time></div>)}</div></section>) : <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs leading-relaxed text-white/35">No learning events yet. Your direct teaching and feedback will appear here.</p>}</div></div>
              </div>}
            </div>
          </section>
          <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Ask your Mind / 01</p>
              <h1 className="mt-3 font-display text-5xl leading-[.86] tracking-[-.07em] sm:text-7xl">Find the moments <span className="text-white/35 italic">worth creating from.</span></h1>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/42">Give SoulCut a public video. Your Mind uses grounded source context to prioritize creative opportunities that fit how you create.</p>
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
                {isWorking ? "Mind at work…" : "Ask your Mind"}
              </button>
            </div>
            <input ref={transcriptInputRef} type="file" accept=".txt,.srt,.vtt,text/plain,text/vtt,application/x-subrip" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 400_000) { toast.error("Transcript files must be 400 KB or smaller."); event.target.value = ""; return; } if (!/\.(txt|srt|vtt)$/i.test(file.name)) { toast.error("Use a .txt, .srt, or .vtt transcript file."); event.target.value = ""; return; } setTranscriptFile(file); }} />
            <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 px-1"><p className="text-xs text-white/32">SoulCut only analyzes public sources it can access. Your Mind guides creative prioritization; the source remains the evidence.</p><div className="flex items-center gap-2">{transcriptFile ? <><span className="max-w-52 truncate text-[11px] text-[#d8ff83]">Transcript: {transcriptFile.name}</span><button type="button" onClick={() => { setTranscriptFile(null); if (transcriptInputRef.current) transcriptInputRef.current.value = ""; }} disabled={isWorking} className="rounded-lg px-2 py-1 text-[11px] text-white/45 transition hover:text-white">Remove</button></> : <button type="button" onClick={() => transcriptInputRef.current?.click()} disabled={isWorking} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/50 transition hover:border-[#c7ff4b]/35 hover:text-[#d8ff83] disabled:opacity-50">Give your Mind a transcript</button>}</div></div>
            <p className="relative mt-2 px-1 text-[10px] leading-relaxed text-white/27">If the public source does not expose reliable timing, attach your creator-exported .txt, .srt, or .vtt transcript. It stays private; timing cues are used only when present.</p>
          </section>

          {isWorking && <AnalysisLoadingCard progress={progress.latestEvent} isConnected={progress.isConnected} hasStreamError={progress.hasStreamError} />}

          {activeJob && !isWorking && (
            <section className="mt-5 space-y-5">
              <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/9 bg-white/[.025] p-5 sm:flex-row sm:items-start sm:p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5"><StatusPill status={activeJob.status} /><span className="font-mono text-[10px] uppercase tracking-[.14em] text-white/32">{activeJob.model ?? "Video research"}</span></div>
                  <p className="mt-4 break-all text-sm leading-relaxed text-white/65">{activeJob.videoUrl}</p>
                  {activeJob.transcriptFormat && <p className="mt-2 text-[11px] text-[#d8ff83]/70">Imported {activeJob.transcriptFormat.toUpperCase()} transcript · {activeJob.transcriptCharacterCount?.toLocaleString() ?? "—"} characters</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => void downloadJobPdf(activeJob.id)} disabled={exportPdf.isPending} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs text-white/60 transition hover:bg-white/8 hover:text-white disabled:opacity-50"><FileText size={13} /> {exportPdf.isPending ? "Preparing PDF" : activeJob.status === "failed" ? "Error report" : "PDF report"}</button><label className="flex items-center rounded-full border border-white/10 bg-white/[.04] px-2 text-xs text-white/52"><span className="sr-only">Share link expiry</span><select value={shareExpiryHours} onChange={event => setShareExpiryHours(Number(event.target.value))} className="bg-transparent py-2 outline-none"><option value={24}>24h</option><option value={168}>7d</option><option value={720}>30d</option><option value={2160}>90d</option></select></label><button type="button" onClick={() => void shareJobPdf(activeJob.id)} disabled={createPdfShare.isPending} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3.5 py-2 text-xs text-white/60 transition hover:bg-white/8 hover:text-white disabled:opacity-50"><Share2 size={13} /> {createPdfShare.isPending ? "Creating link" : "Share link"}</button><a href={activeJob.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-xs text-white/60 transition hover:bg-white/8 hover:text-white"><ExternalLink size={13} /> Source</a></div>
              </div>

              {activeJob.status === "failed" && (
                <div className="rounded-3xl border border-red-400/20 bg-red-400/[.07] p-6">
                  <p className="font-display text-2xl tracking-[-.045em] text-red-100">This source couldn’t be analyzed.</p>
                  <p className="mt-2 text-sm leading-relaxed text-red-100/55">{activeJob.failureReason ?? "Confirm that the source is public and try another URL."}</p>
                </div>
              )}

              {activeJob.status === "done" && activeJob.summary && (
                <>
                  {appliedMindPreferences.length > 0 && <article className="rounded-3xl border border-[#c7ff4b]/16 bg-[#c7ff4b]/[.045] p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow text-[#d8ff83]">Your Mind remembered</p><h2 className="mt-2 font-display text-3xl tracking-[-.055em]">{appliedMindPreferences.length} learned {appliedMindPreferences.length === 1 ? "preference" : "preferences"} applied to this video.</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">You did not need to restate your style. These are the bounded Creative DNA preferences your Mind had already learned when this analysis began.</p></div><span className="font-mono text-[10px] text-[#d8ff83]/70">Persisted at analysis time</span></div><div className="mt-4 flex flex-wrap gap-2">{appliedMindPreferences.map(preference => <span key={`${preference.category}-${preference.value}`} className="rounded-full border border-[#c7ff4b]/18 bg-black/20 px-3 py-1.5 text-xs text-white/70">{preference.value} <span className="text-white/32">· {preference.confidence}%</span></span>)}</div></article>}
                  <article className="result-card result-card--summary rounded-3xl p-6 sm:p-8">
                    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                      <div><p className="eyebrow text-white/50">Video understood</p><h2 className="mt-3 font-display text-4xl tracking-[-.06em]">Executive brief.</h2></div>
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
                      <div><p className="eyebrow">Creative opportunities</p><h2 className="mt-3 font-display text-4xl tracking-[-.06em]">Your Mind found {activeClips.length} {activeClips.length === 1 ? "opportunity" : "opportunities"} that fit.</h2><p className="mt-2 text-sm text-white/44">Grounded in the available source and prioritized through your Creative DNA.</p></div>
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
                            {personalizedQuery.data?.[index] && <div className="mt-3 rounded-xl border border-[#c7ff4b]/14 bg-[#c7ff4b]/[.045] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-medium uppercase tracking-[.13em] text-[#d8ff83]">Why it fits your Creative DNA</p><span className="font-mono text-[10px] text-[#d8ff83]/70">Mind confidence {personalizedQuery.data[index].mindConfidence}%</span></div>{personalizedQuery.data[index].fit.length ? <ul className="mt-2 space-y-1">{personalizedQuery.data[index].fit.map(item => <li key={item.memoryId} className="text-xs leading-relaxed text-white/58">Based on: {item.statement} <span className="text-white/30">({item.evidenceCount} evidence signals)</span></li>)}</ul> : <p className="mt-2 text-xs leading-relaxed text-white/42">No documented Creative DNA preference directly matches this recommendation yet.</p>}<button type="button" onClick={() => setExpandedExplanation(expandedExplanation === index ? null : index)} aria-expanded={expandedExplanation === index} className="mt-3 text-[10px] font-medium text-[#d8ff83] transition hover:text-[#c7ff4b]">{expandedExplanation === index ? "Hide why this" : "Why does my Mind think this?"}</button>{expandedExplanation === index && <div className="mt-3 rounded-lg border border-white/8 bg-black/20 p-3"><p className="text-xs leading-relaxed text-white/68">{personalizedQuery.data[index].explanation.summary}</p>{personalizedQuery.data[index].explanation.evidence.length ? <ul className="mt-3 space-y-2">{personalizedQuery.data[index].explanation.evidence.map(item => <li key={item.memoryId} className="text-xs leading-relaxed text-white/55"><span className="text-white/78">{item.statement}</span><br /><span className="text-white/32">{item.source.replaceAll("_", " ")} · {item.evidenceCount} evidence signals · {item.confidence}% confidence</span></li>)}</ul> : null}{personalizedQuery.data[index].explanation.confidence > 0 && <p className="mt-3 font-mono text-[10px] text-[#d8ff83]/75">Evidence confidence {personalizedQuery.data[index].explanation.confidence}%</p>}</div>}</div>}
                            <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3"><p className="text-[10px] font-medium uppercase tracking-[.13em] text-white/45">Teach your Mind from this moment</p>{feedbackTarget === index ? <div className="mt-3"><p className="text-xs text-white/68">What missed the mark?</p><div className="mt-2 flex flex-wrap gap-1.5">{feedbackReasonOptions.map(option => <button key={option.value} type="button" onClick={() => setFeedbackReason(option.value)} aria-pressed={feedbackReason === option.value} className={`rounded-lg border px-2 py-1.5 text-[10px] transition ${feedbackReason === option.value ? "border-red-300/40 bg-red-300/10 text-red-100" : "border-white/10 text-white/48 hover:border-white/25 hover:text-white"}`}>{option.label}</button>)}</div><label className="mt-3 block text-[10px] text-white/42">Optional correction<textarea value={feedbackText} onChange={event => setFeedbackText(event.target.value)} maxLength={500} className="mt-1.5 min-h-16 w-full resize-none rounded-lg border border-white/10 bg-white/[.035] p-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#c7ff4b]/45" placeholder="e.g. Make this less corporate and get to the point faster." /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void recordRecommendationFeedback(index, "not_my_style", { reason: feedbackReason, feedbackText })} disabled={submitMindFeedback.isPending} className="rounded-lg border border-red-300/35 px-2.5 py-1.5 text-[10px] text-red-100 transition hover:bg-red-300/10 disabled:opacity-50">{submitMindFeedback.isPending ? "Saving" : "Save correction"}</button><button type="button" onClick={() => { setFeedbackTarget(null); setFeedbackText(""); }} className="rounded-lg px-2.5 py-1.5 text-[10px] text-white/43 transition hover:text-white">Cancel</button></div></div> : <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void recordRecommendationFeedback(index, "keep")} disabled={submitMindFeedback.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/58 transition hover:border-[#c7ff4b]/45 hover:text-[#d8ff83] disabled:opacity-50"><ThumbsUp size={12} /> Keep this</button><button type="button" onClick={() => setFeedbackTarget(index)} disabled={submitMindFeedback.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/52 transition hover:border-red-300/35 hover:text-red-100 disabled:opacity-50"><ThumbsDown size={12} /> Not my style</button></div>}</div>
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
