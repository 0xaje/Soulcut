// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ loading: false, isAuthenticated: true }) }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    mind: {
      getMind: { useQuery: () => ({ data: { mind: { id: "mind-7" }, builderAvailability: "available" } }) },
      getCreativeDNA: {
        useQuery: () => ({
          data: { memories: [{ id: 1, value: "Question-first hooks" }], stats: { feedbackCount: 1 } },
        }),
      },
      getRecommendationComparison: { useQuery: () => ({ data: [{ jobId: "one" }, { jobId: "two" }] }) },
    },
    videoJobs: {
      list: { useQuery: () => ({ data: [{ id: "one", status: "done" }, { id: "two", status: "done" }] }) },
    },
  },
}));

import LiveWalkthrough from "../client/src/pages/LiveWalkthrough";

describe("live judge walkthrough", () => {
  it("renders completion labels from real query-derived state and explains the Minds layer", () => {
    render(<LiveWalkthrough />);
    expect(screen.getByRole("heading", { name: /your mind remembers/i })).toBeTruthy();
    expect(screen.getByText("Two-video proof available")).toBeTruthy();
    expect(screen.getByText("Comparison available")).toBeTruthy();
    expect(screen.getByText(/Minds provides the persistent intelligence layer/i)).toBeTruthy();
  });
});
