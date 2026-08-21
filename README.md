<div align="center">

# SoulCut

### **AI-Native Creative Director for High-Retention Short-Form Distillation**

*Transform long-form YouTube videos and podcasts into viral short-form video briefs powered by your own persistent, evolving Creative Mind.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg?style=flat-square)](https://react.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-v11-2596be.svg?style=flat-square)](https://trpc.io/)
[![Minds API](https://img.shields.io/badge/Minds%20API-Persistent%20Memory-8A2BE2.svg?style=flat-square)](https://useminds.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama%203.3%2070B-orange.svg?style=flat-square)](https://groq.com/)
[![Vitest](https://img.shields.io/badge/Tests-89%20Passing-brightgreen.svg?style=flat-square)](https://vitest.dev/)

[**Quick Start**](#quick-start) • [**Live Walkthrough**](/walkthrough) • [**Documentation**](./docs/GETTING_STARTED.md) • [**Architecture**](./docs/ARCHITECTURE.md) • [**Workflow**](#core-workflow) • [**Configuration**](#configuration)

---

</div>

## What is SoulCut?

Traditional video AI tools generate generic, cookie-cutter clips because they have **no memory** of what you actually like. 

**SoulCut is different.** It combines **Groq's fast LLM inference** with **Minds API persistent memory** (`@animocabrands/minds-client-lib`) to create a personalized AI Creative Director that:
1. **Remembers Your Style**: Learns your pacing, hook preferences, emotional resonance rules, and editing aesthetics.
2. **Evolves With Every Clip**: Dynamically updates confidence weights as you accept (Keep) or reject (Not My Style) suggestions.
3. **Automated Zero-Dependency Ingestion**: Automatically extracts transcripts directly from public YouTube URLs with grounded timestamp alignment.
4. **Pro NLE Timeline Exports**: Generates 1-click timeline project files for **Adobe Premiere Pro / DaVinci Resolve (`.edl`)**, **Final Cut Pro (`.fcpxml`)**, **CapCut Project (`.json`)**, **Subtitles (`.srt`)**, and **Executive PDF Briefs**.
5. **AI Hook Re-Angle Engine**: Reframes any clip hook into 4 distinct angles (*Urgent*, *Question*, *Contrarian*, *Story*) based on your Creative DNA.
6. **Multi-Platform 9:16 Safe Zones**: Interactive mobile framing guides for **TikTok**, **Instagram Reels**, and **YouTube Shorts**.

---

## Core Features

### 🧠 Persistent Creative Mind (Powered by Minds API)
- **Creative DNA Profile**: Maintains explicit, auditable memory records of your editorial preferences.
- **Dynamic Confidence Graph**: Each rule has an evolving confidence rating (1-100%) reinforced by evidence from real videos.
- **Zero Prompt Restatements**: Teach your Mind once; it automatically guides every future video analysis.

### 🎬 Grounded Video Distillation
- **Automated YouTube Scraping**: Instant zero-click transcript ingestion from any public YouTube URL.
- **Transcript Support**: Attach `.txt`, `.srt`, or `.vtt` caption files for frame-accurate timing.
- **Anti-Hallucination Grounding**: Clip boundaries and quotes are strictly validated against verified transcript timestamps.

### ✂️ Pro Studio NLE Project Exports
- **CMX 3600 EDL**: Direct timeline import for Adobe Premiere Pro & DaVinci Resolve.
- **Final Cut Pro XML (`.fcpxml`)**: Full event and clip sequence metadata for Apple Final Cut Pro.
- **CapCut Timeline JSON**: Project JSON for mobile and desktop CapCut workflows.
- **Subtitles & Timed Hooks (`.srt`)**: Frame-accurate closed captions.
- **Markdown Script (`.md`) & Executive PDF Briefs**: Comprehensive client-ready production notes.

### 📱 9:16 Safe-Zone Framing & Audio Equalizer
- Segmented viewport toggles for **TikTok**, **Instagram Reels**, and **YouTube Shorts**.
- Live pulsating 4-bar equalizer visualizer on active playing clip cards.

### Adaptive Feedback Loop
- **Positive Reinforcement (Keep)**: Boosts the weight and confidence of the editorial rules that produced the clip.
- **Corrective Feedback (Not My Style)**: Adjusts weighting and documents corrective guidance to avoid recurring mistakes.
- **Evidence Audit Trail**: Inspect the exact history of prompts, videos, and feedback that shaped any rule.

### Real-Time SSE Progress Stream
- Live visual updates as your video moves through stages:
  `Reading Metadata` -> `Distilling Narrative` -> `Shaping Viral Clips` -> `Complete`.

### Executive PDF Briefs and Public Sharing
- Download clean, printable executive PDF summaries of every video distillation.
- Create time-limited, passwordless public share links with custom studio branding.

### Dual-Mode Resilient Storage
- **Zero-Barrier Setup**: Automatically operates with an ultra-fast in-memory fallback store when no database is configured.
- **Production MySQL**: Plug in any MySQL database (`DATABASE_URL`) for persistent enterprise storage.

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/0xaje/Soulcut.git
cd Soulcut
npm install
```

### 2. Configure Environment

Copy the example environment template:

```bash
cp .env.example .env
```

Add your **Groq API Key** and **Minds API** credentials in `.env`:

```env
VITE_APP_TITLE=SoulCut

# Minds Persistent Memory
MINDS_API_KEY=your_minds_jwt_or_api_key
MINDS_BASE_URL=https://api.useminds.com
MINDS_APP_ID=your_mind_id
MINDS_MIND_ID=your_mind_id

# AI Engine (Groq Fast Inference)
BUILT_IN_FORGE_API_URL=https://api.groq.com/openai
BUILT_IN_FORGE_API_KEY=gsk_your_groq_api_key
LLM_MODEL=llama-3.3-70b-versatile
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [`http://localhost:3000`](http://localhost:3000) in your browser.

---

## Core Workflow

```mermaid
graph TD
    A[Sign In / Onboard] --> B[Meet Creative Mind]
    B --> C[Teach Mind with Reference Video / Rules]
    C --> D[Paste YouTube URL to Distill]
    D --> E[Real-Time Progress Streaming SSE]
    E --> F[Review Timestamped Clips & Hooks]
    F -->|Keep| G[Confidence Boost & Reinforced Memory]
    F -->|Not My Style| H[Rule Correction & Weight Adjustment]
    G --> I[Export PDF Brief / Share Public Link]
    H --> I
```

1. **Meet Your Mind**: Complete the quick onboarding to set baseline energy, pacing, and visual style.
2. **Teach Your Mind**: Paste a reference video or type editing preferences to build your **Creative DNA**.
3. **Distill Videos**: Paste a long-form YouTube URL and watch the real-time analysis stream.
4. **Iterate and Refine**: Use the Keep / Not My Style buttons on clip suggestions to evolve your Mind's editorial accuracy.
5. **Export and Share**: Generate client PDF reports or tokenized share links.

---

## Repository Structure

```
Soulcut/
├── client/                     # Frontend Application (React 18, Vite, Tailwind)
│   ├── src/
│   │   ├── pages/              # Landing, Workspace, Onboarding, Shared Brief
│   │   ├── components/         # Workspace UI, Creative DNA, Clip Cards, Modals
│   │   └── lib/                # tRPC client, state management, audio utilities
├── server/                     # Backend API and Workers (Express, tRPC v11, Node.js)
│   ├── _core/                  # Server bootstrap, OAuth, LLM adapter, tRPC context
│   ├── routers/                # tRPC endpoints (mind, videoJobs, auth)
│   ├── analysisWorker.ts       # Durable background job processor and worker pool
│   ├── videoAnalysis.ts        # Grounded LLM distillation and JSON schema validation
│   ├── mindAnalysisContext.ts  # Snapshot builder for active creator preferences
│   ├── mindsAdapter.ts         # Minds SDK / HTTP REST synchronization bridge
│   ├── jobPdfReport.ts         # PDF generation engine
│   └── db.ts                   # Dual-mode database layer (MySQL + In-Memory Store)
├── drizzle/                    # Database schema definitions and migrations
├── docs/                       # Comprehensive documentation space
│   ├── GETTING_STARTED.md      # Detailed step-by-step user and deployment guide
│   ├── ARCHITECTURE.md         # Technical architecture and memory design
│   └── minds-transformation-audit.md
├── package.json
└── tsconfig.json
```

---

## Testing and Validation

SoulCut includes a robust Vitest test suite covering end-to-end user journeys, worker execution, memory evolution, and UI components:

```bash
# Run all tests
npm test

# Run TypeScript validation
npm run check

# Production build
npm run build
```

---

## Detailed Documentation

For in-depth guides, visit the documentation space in [`docs/`](./docs):
- [**Getting Started and User Guide**](./docs/GETTING_STARTED.md)
- [**Technical Architecture and Memory Design**](./docs/ARCHITECTURE.md)
- [**Minds API Transformation Audit**](./docs/minds-transformation-audit.md)

---

## License

This project is licensed under the MIT License.
