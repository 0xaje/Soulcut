# 🏛️ SoulCut Architecture & Technical Design

This document details the internal architecture, memory evolution lifecycle, streaming event pipeline, and data layer of **SoulCut**.

---

## 1. High-Level System Overview

SoulCut is structured into 4 decoupled layers:

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│     React 18 + Tailwind CSS + Framer Motion + TanStack Query │
│         (Interactive Workspace, Creative DNA, Reports)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ tRPC v11 + SSE EventSource
┌──────────────────────────────▼──────────────────────────────┐
│                    Application Server                       │
│        Express + tRPC Router + Background Worker Pool       │
├─────────────────────────────────────────────────────────────┤
│ • /api/trpc/*          -> Type-safe RPC Endpoints           │
│ • /api/analysis/stream -> Live SSE Progress Pipeline        │
│ • /api/reports/shared  -> Tokenized Client Brief Views      │
│ • /api/scheduled/*     -> Durable Worker & Cleanup Jobs     │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
┌───────────────▼─────────────┐ ┌─────────────▼───────────────┐
│     AI & Memory Engine      │ │      Dual-Mode Storage      │
│ • Minds SDK / REST API      │ │ • MySQL (Drizzle ORM)       │
│ • Groq LLM (Llama 3.3 70B)  │ │ • Resilient In-Memory Store │
│ • Grounded Video Distillation│ │ • Local / S3 File Storage  │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. The Creative Mind Memory & Feedback Loop

Unlike standard one-shot prompt wrappers, SoulCut maintains a **persistent learning loop** for every creator.

### Memory Evolution Lifecycle
1. **Teaching Input**: Creator teaches the Mind via reference videos or direct stylistic rules.
2. **Context Snapshot**: When a video analysis begins, the system takes a snapshot of the creator's top-confidence active preferences.
3. **Grounded Distillation**: The LLM analyzes the video grounded by source transcripts and guided by the snapshot rules.
4. **Creator Review**: Creator inspects the suggested clips and provides positive (`keep`) or corrective (`not_my_style`) signals.
5. **Confidence Adjustment**:
   - `keep` signals increment the preference confidence score (capped at 100%) and record new evidence.
   - `not_my_style` signals decrease weight or create corrective counter-rules.
6. **Auditability**: Every single preference maintains an explicit history of every video and prompt that influenced it.

---

## 3. Real-Time SSE Progress Pipeline

Video analysis is executed asynchronously to handle large videos gracefully without hanging HTTP connections:

1. **Submission**: `videoJobs.create` enqueues the job and registers a `queued` progress event.
2. **Execution**: The background processor claims the job and emits stage updates:
   - `reading`: Video metadata & transcript fetching.
   - `analyzing`: Narrative breakdown & theme extraction.
   - `clips`: Grounded clip timestamping & hook generation.
   - `complete`: Final brief assembly.
3. **Streaming**: The client subscribes via `EventSource` to `/api/analysis/stream?jobId=...` to render interactive progress animations in real time.

---

## 4. Dual-Mode Storage Architecture

To provide zero-barrier testing while supporting production scale, [`server/db.ts`](file:///home/oyeolorun/Soulcut/server/db.ts) implements an abstraction with automatic fallback:

- **MySQL + Drizzle ORM**: Active when `DATABASE_URL` is set to a valid MySQL connection.
- **In-Memory Store**: Automatically activates if `DATABASE_URL` is omitted or unconfigured. Maintains consistent state across all tRPC routers in memory.

---

## 5. Security & Privacy

- **Safe Video Analysis**: The system treats video transcripts and external URLs as untrusted input, preventing prompt injection attacks.
- **Tokenized Public Shares**: Shared reports use cryptographically secure `nanoid(32)` tokens with optional expiry dates and instant revocation capabilities.
- **Role-Based Access**: Creator data and preferences are strictly partitioned per authenticated user.
