// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../client/src/_core/hooks/useAuth", () => ({
  useAuth: () => ({ loading: false, isAuthenticated: true }),
}));

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    mind: {
      getMind: { useQuery: () => ({ data: { builderAvailability: "available" } }) },
      getCreativeDNA: { useQuery: () => ({ data: { stats: { preferenceCount: 3, feedbackCount: 2, strongPatterns: 1, averageConfidence: 82 }, memories: [] }, refetch: vi.fn() }) },
      getMindActivity: { useQuery: () => ({ data: [{ id: 1, activityType: "learned", message: "Learned: Fast pacing", createdAt: new Date() }], refetch: vi.fn() }) },
      getPreferenceEvidence: { useQuery: () => ({ data: [], isLoading: false }) },
      updatePreference: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      retirePreference: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      restorePreference: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      resetMind: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
  },
}));

import CreativeDNA from "../client/src/pages/CreativeDNA";

describe("Creative DNA route", () => {
  it("renders private evidence-backed Creative DNA and grouped persisted Mind activity", () => {
    render(<CreativeDNA />);

    expect(screen.getByRole("heading", { name: /your creative dna/i })).toBeTruthy();
    expect(screen.getByText("Minds connected")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Learned: Fast pacing")).toBeTruthy();
    expect(screen.getByRole("link", { name: /workspace/i }).getAttribute("href")).toBe("/app");
  });
});
