import { describe, expect, it } from "vitest";
import { formatProgressSse } from "./analysisProgressStream";

describe("analysis progress stream", () => {
  it("serializes a safe SSE progress event with its analysis stage", () => {
    const payload = {
      id: 8,
      stage: "analyzing" as const,
      message: "Distilling the core story and key topics.",
      createdAt: new Date("2026-08-14T03:30:00.000Z"),
    };

    const output = formatProgressSse(payload);

    expect(output).toMatch(/^event: progress\ndata: /);
    expect(output).toMatch(/\n\n$/);
    expect(JSON.parse(output.split("data: ")[1].trim())).toMatchObject({
      id: 8,
      stage: "analyzing",
      message: "Distilling the core story and key topics.",
    });
  });

  it("serializes a terminal failure update for the client to display", () => {
    expect(
      formatProgressSse({
        id: 9,
        stage: "failed",
        message: "The analysis could not be completed.",
        createdAt: new Date(),
      })
    ).toContain('"stage":"failed"');
  });
});
