export type HistoryFilter = "all" | "done" | "failed";

type JobWithStatus = {
  status: "pending" | "processing" | "done" | "failed";
};

export function filterJobHistory<T extends JobWithStatus>(jobs: T[], filter: HistoryFilter): T[] {
  if (filter === "all") return jobs;
  return jobs.filter(job => job.status === filter);
}
