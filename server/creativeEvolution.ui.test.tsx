// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ loading: false, isAuthenticated: true }) }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    mind: {
      getRecommendationComparison: {
        useQuery: () => ({
          isLoading: false,
          data: [
            { jobId: "first", videoUrl: "https://video.example/first", createdAt: new Date("2026-08-12T10:00:00.000Z"), transcriptFormat: null, clipCount: 1, appliedPreferenceCount: 1, appliedPreferences: [{ category: "hook", value: "Question-first hooks", confidence: 84, evidenceCount: 3 }], keptCount: 0, correctedCount: 0 },
            { jobId: "second", videoUrl: "https://video.example/second", createdAt: new Date("2026-08-14T10:00:00.000Z"), transcriptFormat: "vtt", clipCount: 2, appliedPreferenceCount: 2, appliedPreferences: [{ category: "hook", value: "Question-first hooks", confidence: 84, evidenceCount: 3 }, { category: "pacing", value: "Fast openings", confidence: 80, evidenceCount: 2 }], keptCount: 1, correctedCount: 1 },
          ],
        }),
      },
    },
  },
}));

import CreativeEvolution from "../client/src/pages/CreativeEvolution";

describe("Creative Evolution route", () => {
  it("renders only recorded analysis-time context, opportunities, and explicit feedback instead of a fabricated quality score", () => {
    render(<CreativeEvolution />);
    expect(screen.getByRole("heading", { name: /your creative evolution/i })).toBeTruthy();
    expect(screen.getByText(/mind is not static/i)).toBeTruthy();
    expect(screen.getAllByText("Question-first hooks")).toHaveLength(2);
    expect(screen.getByText("Creator-provided VTT transcript")).toBeTruthy();
    expect(screen.getByText("Applied Creative DNA")).toBeTruthy();
    expect(screen.getAllByText("Applied DNA at analysis time")).toHaveLength(2);
  });
});
