export type HistoryFilter = "all" | "done" | "failed";

export type JobWithStatus = {
  status: "pending" | "processing" | "retrying" | "done" | "failed" | "cancelled";
};

type JobWithIdAndStatus = JobWithStatus & { id: string };

export function filterJobHistory<T extends JobWithStatus>(jobs: T[], filter: HistoryFilter): T[] {
  if (filter === "all") return jobs;
  return jobs.filter(job => job.status === filter);
}

export function getVisibleHistorySelection<T extends JobWithIdAndStatus>(
  jobs: T[],
  filter: HistoryFilter,
  activeId: string | null
): string | null {
  const visibleJobs = filterJobHistory(jobs, filter);
  if (!visibleJobs.length) return null;
  return activeId && visibleJobs.some(job => job.id === activeId) ? activeId : visibleJobs[0].id;
}
