type CsvJob = {
  id: string;
  videoUrl: string;
  status: "pending" | "processing" | "done" | "failed";
  createdAt: Date | string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  summary: string | null;
  topics: string[] | null;
  clips: unknown[] | null;
  model: string | null;
  failureReason: string | null;
};

type CsvProgressEvent = {
  id: number;
  jobId: string;
  stage: string;
  message: string;
  createdAt: Date | string;
};

const headers = [
  "job_id",
  "video_url",
  "job_status",
  "job_created_at",
  "job_started_at",
  "job_completed_at",
  "summary",
  "topics",
  "clip_count",
  "model",
  "failure_reason",
  "stage_order",
  "stage",
  "stage_message",
  "stage_created_at",
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeCell(value: unknown): string {
  let text = formatValue(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildJobHistoryCsv(jobs: CsvJob[], events: CsvProgressEvent[]): string {
  const eventGroups = new Map<string, CsvProgressEvent[]>();
  for (const event of events) {
    const existing = eventGroups.get(event.jobId) ?? [];
    existing.push(event);
    eventGroups.set(event.jobId, existing);
  }

  const rows = jobs.flatMap(job => {
    const jobEvents = (eventGroups.get(job.id) ?? []).sort((a, b) => a.id - b.id);
    const base = [
      job.id,
      job.videoUrl,
      job.status,
      job.createdAt,
      job.startedAt,
      job.completedAt,
      job.summary,
      job.topics?.join(" | ") ?? "",
      job.clips?.length ?? 0,
      job.model,
      job.failureReason,
    ];
    if (!jobEvents.length) return [[...base, "", "", "", ""]];
    return jobEvents.map((event, index) => [
      ...base,
      index + 1,
      event.stage,
      event.message,
      event.createdAt,
    ]);
  });

  return [headers, ...rows].map(row => row.map(escapeCell).join(",")).join("\r\n");
}
