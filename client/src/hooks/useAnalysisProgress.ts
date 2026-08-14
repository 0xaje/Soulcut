import { COOKIE_NAME } from "@shared/const";
import { useEffect, useMemo, useState } from "react";

export type AnalysisProgressStage = "queued" | "reading" | "analyzing" | "clips" | "retrying" | "complete" | "failed" | "cancelled";

export type AnalysisProgressEvent = {
  id: number;
  stage: AnalysisProgressStage;
  message: string;
  createdAt: string;
};

function getAuthHeaders(): HeadersInit {
  try {
    const raw = sessionStorage.getItem("manus-cookie");
    const prefix = `${COOKIE_NAME}=`;
    const pair = raw?.split(";").find(value => value.trim().startsWith(prefix));
    const token = pair?.trim().slice(prefix.length);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function extractEvents(buffer: string): { events: AnalysisProgressEvent[]; remainder: string } {
  const packets = buffer.split("\n\n");
  const remainder = packets.pop() ?? "";
  const events = packets.flatMap(packet => {
    const dataLine = packet.split("\n").find(line => line.startsWith("data: "));
    if (!dataLine) return [];
    try {
      return [JSON.parse(dataLine.slice(6)) as AnalysisProgressEvent];
    } catch {
      return [];
    }
  });
  return { events, remainder };
}

export function useAnalysisProgress(jobId: string | null) {
  const [events, setEvents] = useState<AnalysisProgressEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [hasStreamError, setHasStreamError] = useState(false);

  useEffect(() => {
    setEvents([]);
    setIsConnected(false);
    setHasStreamError(false);
    if (!jobId) return;

    const controller = new AbortController();

    const connect = async () => {
      try {
        const response = await fetch(`/api/video-jobs/${encodeURIComponent(jobId)}/progress`, {
          method: "GET",
          headers: getAuthHeaders(),
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error("Progress stream is unavailable.");
        }

        setIsConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = extractEvents(buffer);
          buffer = parsed.remainder;
          if (parsed.events.length) {
            setEvents(previous => {
              const next = [...previous];
              for (const event of parsed.events) {
                if (event.id !== 0 && next.some(item => item.id === event.id)) continue;
                if (event.id === 0 && next.some(item => item.id === 0 && item.stage === event.stage)) continue;
                next.push(event);
              }
              return next;
            });
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) setHasStreamError(true);
      } finally {
        if (!controller.signal.aborted) setIsConnected(false);
      }
    };

    void connect();
    return () => controller.abort();
  }, [jobId]);

  return useMemo(
    () => ({
      latestEvent: events.at(-1) ?? null,
      events,
      isConnected,
      hasStreamError,
    }),
    [events, hasStreamError, isConnected]
  );
}
