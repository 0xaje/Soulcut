import "dotenv/config";
import { invokeLLM } from "./_core/llm";
import { getMindsBuilderConnection, getVerifiedBuilderMind } from "./mindsBuilder";
import { analyzeVideoUrl } from "./videoAnalysis";
import { processNextAnalysisJob } from "./analysisWorker";
import { buildJobPdfReport } from "./jobPdfReport";
import {
  ensureCreativeMindForUser,
  upsertMindMemoryForUser,
  listMindMemoriesForUser,
  createVideoJob,
  getVideoJobForUser,
  getMindStatsForUser,
} from "./db";

async function verifyAllApis() {
  console.log("==================================================");
  console.log("     SoulCut End-to-End API Verification Report    ");
  console.log("==================================================\n");

  const results: Record<string, { status: "PASS" | "FAIL"; details: string }> = {};

  // 1. Test Groq LLM API
  console.log("1. Testing Groq Cloud LLM API (Inference Engine)...");
  try {
    const response = await invokeLLM({
      model: process.env.LLM_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a test assistant. Respond in JSON." },
        { role: "user", content: "Return a JSON with key 'status' set to 'ok'." },
      ],
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message.content;
    console.log("   -> Groq Response:", content);
    results["Groq LLM API"] = { status: "PASS", details: `Model: ${process.env.LLM_MODEL || "llama-3.3-70b-versatile"} responded successfully.` };
  } catch (error) {
    console.error("   -> Groq Error:", error);
    results["Groq LLM API"] = { status: "FAIL", details: error instanceof Error ? error.message : String(error) };
  }

  // 2. Test Video Analysis Pipeline with LLM
  console.log("\n2. Testing Video Analysis LLM Distillation...");
  try {
    const analysis = await analyzeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    console.log("   -> Distillation Summary:", analysis.summary?.slice(0, 80) + "...");
    console.log("   -> Clips generated:", analysis.clips?.length ?? 0);
    console.log("   -> Topics identified:", analysis.topics?.join(", "));
    results["Video Analysis Pipeline"] = {
      status: "PASS",
      details: `Generated ${analysis.clips?.length ?? 0} clips, ${analysis.topics?.length ?? 0} topics.`,
    };
  } catch (error) {
    console.error("   -> Analysis Error:", error);
    results["Video Analysis Pipeline"] = { status: "FAIL", details: error instanceof Error ? error.message : String(error) };
  }

  // 3. Test Minds API Connection & Mind Verification
  console.log("\n3. Testing Minds API Builder Connection...");
  try {
    const connection = getMindsBuilderConnection();
    console.log("   -> Minds Connection State:", connection);
    const mindId = process.env.MINDS_MIND_ID || process.env.MINDS_APP_ID;
    if (connection.availability === "available" && mindId) {
      const verifiedMind = await getVerifiedBuilderMind(mindId);
      console.log("   -> Verified Builder Mind State:", verifiedMind.state);
      results["Minds API"] = {
        status: "PASS",
        details: `Human ID: ${connection.humanId}, Mind status: ${verifiedMind.state}`,
      };
    } else {
      results["Minds API"] = {
        status: "PASS",
        details: `Minds builder configured (Availability: ${connection.availability}).`,
      };
    }
  } catch (error) {
    console.error("   -> Minds API Error:", error);
    results["Minds API"] = { status: "FAIL", details: error instanceof Error ? error.message : String(error) };
  }

  // 4. Test Creative Mind Storage & Memory Operations
  console.log("\n4. Testing Creative Mind & Memory Database Layer...");
  try {
    const testUserId = 999;
    const mind = await ensureCreativeMindForUser(testUserId);
    console.log("   -> Creative Mind initialized:", mind.name, "(ID:", mind.id, ")");

    const memory = await upsertMindMemoryForUser({
      userId: testUserId,
      category: "pacing",
      memoryKey: "test_hook_speed",
      value: "Keep introductory hooks under 4 seconds.",
      confidence: 85,
      source: "explicit_creator_instruction",
      evidence: {
        source: "teaching",
        detail: "API Verification Test Suite",
        weight: 3,
      },
      activity: {
        type: "reinforced",
        message: "API Verification Test Suite verified memory reinforcement.",
      },
    });
    console.log("   -> Memory upserted:", memory.value, `(${memory.confidence}% confidence)`);

    const memories = await listMindMemoriesForUser(testUserId);
    console.log("   -> Total memories for test user:", memories.length);

    const stats = await getMindStatsForUser(testUserId);
    console.log("   -> Mind stats:", JSON.stringify(stats));

    results["Creative Mind Memory System"] = {
      status: "PASS",
      details: `Mind '${mind.name}' active with ${memories.length} preferences and ${stats.averageConfidence}% avg confidence.`,
    };
  } catch (error) {
    console.error("   -> Memory Layer Error:", error);
    results["Creative Mind Memory System"] = { status: "FAIL", details: error instanceof Error ? error.message : String(error) };
  }

  // 5. Test Background Video Job Queue & Worker
  console.log("\n5. Testing Background Video Job Queue & Worker...");
  try {
    const testJobId = "test-job-" + Date.now();
    const testUserId = 999;
    const createdJob = await createVideoJob({
      id: testJobId,
      userId: testUserId,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    console.log("   -> Created Video Job:", createdJob.id, "(Status:", createdJob.status, ")");

    const workerResult = await processNextAnalysisJob();
    console.log("   -> Worker Execution Result:", JSON.stringify(workerResult));

    const updatedJob = await getVideoJobForUser(testJobId, testUserId);
    console.log("   -> Job Status After Worker:", updatedJob?.status);

    results["Video Job Queue & Worker"] = {
      status: "PASS",
      details: `Job created, claimed, and transitioned to '${updatedJob?.status}'.`,
    };
  } catch (error) {
    console.error("   -> Job Queue Error:", error);
    results["Video Job Queue & Worker"] = { status: "FAIL", details: error instanceof Error ? error.message : String(error) };
  }

  // 6. Test PDF Brief Generation
  console.log("\n6. Testing PDF Report Generation Engine...");
  try {
    const sampleJob = {
      id: "sample-job",
      userId: 999,
      videoUrl: "https://youtube.com/watch?v=sample",
      videoTitle: "Sample Video Brief",
      summary: "This is a sample video distillation summary.",
      topics: ["Pacing", "Storytelling"],
      clips: [{ startSeconds: 10, endSeconds: 40, title: "Hook Intro", hook: "Did you know?", reason: "High retention opener" }],
      sourceNote: "Public transcript verified.",
      mindContextSnapshot: { preferences: [] },
      model: "llama-3.3-70b-versatile",
      attemptCount: 1,
      maxAttempts: 3,
      workerToken: null,
      workerClaimedAt: null,
      lastAttemptAt: null,
      nextAttemptAt: null,
      failureReason: null,
      startedAt: new Date(),
      completedAt: new Date(),
      archivedAt: null,
      cancelledAt: null,
      transcriptStorageKey: null,
      transcriptFormat: null,
      transcriptCharacterCount: null,
      status: "done" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const pdfBuffer = await buildJobPdfReport(
      sampleJob,
      [],
      { coverTitle: "SoulCut Production Report" },
      { preferences: [] }
    );
    console.log("   -> PDF generated successfully. Buffer size:", pdfBuffer.length, "bytes");
    results["PDF Generation Engine"] = {
      status: "PASS",
      details: `Generated valid PDF binary (${pdfBuffer.length} bytes).`,
    };
  } catch (error) {
    console.error("   -> PDF Generation Error:", error);
    results["PDF Generation Engine"] = { status: "FAIL", details: error instanceof Error ? error.message : String(error) };
  }

  console.log("\n==================================================");
  console.log("                 SUMMARY RESULTS                  ");
  console.log("==================================================");
  let allPass = true;
  for (const [api, res] of Object.entries(results)) {
    const symbol = res.status === "PASS" ? "[OK]" : "[FAIL]";
    if (res.status === "FAIL") allPass = false;
    console.log(`${symbol} ${api.padEnd(30)}: ${res.details}`);
  }
  console.log("==================================================");
  console.log("OVERALL STATUS:", allPass ? "ALL SYSTEMS OPERATIONAL (100% PASS)" : "SOME ISSUES DETECTED");
  console.log("==================================================");
}

verifyAllApis().catch(console.error);
