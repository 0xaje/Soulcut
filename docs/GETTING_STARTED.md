# 📖 SoulCut: Comprehensive Getting Started & User Guide

Welcome to **SoulCut** — an AI-native Creative Director that learns your unique editorial style and distills long-form YouTube videos and podcasts into high-impact short-form video briefs.

This guide walks you through setup, running the application, teaching your Creative Mind, analyzing videos, and exporting production briefs.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Quick Installation](#2-quick-installation)
3. [Environment Configuration](#3-environment-configuration)
4. [Step-by-Step Workflow](#4-step-by-step-workflow)
   - [Step 1: Meet Your Creative Mind (Onboarding)](#step-1-meet-your-creative-mind-onboarding)
   - [Step 2: Teaching Your Mind](#step-2-teaching-your-mind)
   - [Step 3: Distilling Long-Form Videos](#step-3-distilling-long-form-videos)
   - [Step 4: Real-Time Live Analysis Streaming](#step-4-real-time-live-analysis-streaming)
   - [Step 5: Reviewing Clip Suggestions & Giving Feedback](#step-5-reviewing-clip-suggestions--giving-feedback)
   - [Step 6: Inspecting Creative DNA & Evidence Audit](#step-6-inspecting-creative-dna--evidence-audit)
   - [Step 7: PDF Brief & Tokenized Public Share Link](#step-7-pdf-brief--tokenized-public-share-link)
5. [Database Options: In-Memory vs. Cloud MySQL](#5-database-options-in-memory-vs-cloud-mysql)
6. [Supported Video & Transcript Formats](#6-supported-video--transcript-formats)
7. [Running Tests & Quality Checks](#7-running-tests--quality-checks)

---

## 1. Prerequisites

Before getting started, make sure you have:
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm` or `pnpm`
- **Groq API Key** (or OpenAI API key): For LLM inference ([console.groq.com](https://console.groq.com))
- **Minds API Credentials** (Optional/Built-in): For syncing with external Minds instances ([useminds.com](https://useminds.com))

---

## 2. Quick Installation

Clone the repository and install all dependencies:

```bash
# Clone the repository
git clone https://github.com/0xaje/Soulcut.git
cd Soulcut

# Install dependencies
npm install
```

Start the local development server:

```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 3. Environment Configuration

Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Here is a recommended `.env` setup:

```env
# Application Name
VITE_APP_TITLE=SoulCut

# Minds Configuration
MINDS_API_KEY=your_minds_jwt_or_api_key
MINDS_BASE_URL=https://api.useminds.com
MINDS_APP_ID=your_mind_id
MINDS_MIND_ID=your_mind_id

# AI Engine (Groq Fast Inference)
BUILT_IN_FORGE_API_URL=https://api.groq.com/openai
BUILT_IN_FORGE_API_KEY=gsk_your_groq_api_key
LLM_MODEL=llama-3.3-70b-versatile

# (Optional) Database URL - If omitted, SoulCut uses its built-in in-memory fallback store
# DATABASE_URL=mysql://user:password@localhost:3306/soulcut
```

---

## 4. Step-by-Step Workflow

### Step 1: Meet Your Creative Mind (Onboarding)
1. Navigate to the landing page and click **"Meet Your Creative Mind →"** or click **Sign In** in the top navigation.
2. The initial onboarding takes you through your baseline taste preferences:
   - **Pacing & Energy**: Snappy high-retention vs. reflective deep-dive.
   - **Hook Strategy**: Bold contrarian opening vs. question-first framing.
   - **Visual Direction**: Fast-paced B-roll cuts vs. continuous subject focus.
3. Click **"Complete Onboarding"** to initialize your Creative Mind.

### Step 2: Teaching Your Mind
You can train your Mind at any time using two methods:
- **Reference YouTube Video**: Paste a YouTube link of an edit or video you love. Your Mind analyzes the content style and extracts underlying editorial lessons.
- **Direct Creator Lessons**: Type direct rules like *"Keep hooks under 3 seconds, prioritize high-emotion vulnerability, avoid generic buzzwords"*.
- **Live Memory Reinforcement**: Every lesson creates an entry in your Mind's **Creative DNA** with confidence scoring and evidence logs.

### Step 3: Distilling Long-Form Videos
1. In the **Workspace** tab, locate the video input card.
2. Paste any public YouTube video URL (e.g. `https://www.youtube.com/watch?v=...`).
3. *(Optional)* If the video does not have public captions or you have an exact transcript, click **"Attach Transcript"** to upload a `.txt`, `.srt`, or `.vtt` file.
4. Click **"Distill Video Brief"**.

### Step 4: Real-Time Live Analysis Streaming
Once submitted, SoulCut's background worker claims the job and streams real-time status updates via Server-Sent Events (SSE):
- 🟢 **Reading Context**: Worker claims the job and fetches video metadata and transcript.
- 🟢 **Distilling Core Story**: Context snapshot is applied through your Creative Mind preferences.
- 🟢 **Shaping Grounded Clips**: Timestamped hooks, virality scores, and editorial rationale are generated.
- 🟢 **Complete**: Brief ready in seconds.

### Step 5: Reviewing Clip Suggestions & Giving Feedback
Each generated brief includes:
- **Core Summary**: High-level narrative distilled from the long-form video.
- **Key Topics**: Categorized tags and story pillars.
- **Clip Recommendations**:
  - Exact timestamp range (`00:15 - 01:05`).
  - Suggested hook text.
  - Editorial rationale explaining why this segment works for short-form retention.
- **Feedback Buttons**:
  - 👍 **Keep**: Reinforces the preference rules that produced this recommendation, increasing their confidence score in your Mind.
  - 👎 **Not My Style**: Marks a correction, triggering an adjustment in your Mind's weighting.

### Step 6: Inspecting Creative DNA & Evidence Audit
Navigate to the **Creative DNA** tab to see your Mind's inner workings:
- **Confidence Evolution Chart**: See how your Mind's preferences have evolved across each training cycle.
- **Active vs. Retired Memories**: Adjust, refine, or retire specific editorial rules.
- **Evidence Trail**: Click any preference to see the full audit trail of videos, feedback events, and direct instructions that created or altered that rule.

### Step 7: PDF Brief & Tokenized Public Share Link
- **Export PDF Brief**: Click **"Export PDF"** on any completed video brief to download a client-ready executive summary.
- **Branded Report Settings**: Customize your studio name and upload a custom logo.
- **Tokenized Share Links**: Generate passwordless, time-limited share links to collaborate with clients and editors without requiring them to log in.

---

## 5. Database Options: In-Memory vs. Cloud MySQL

SoulCut features a **dual-mode storage architecture**:
1. **In-Memory Fallback (Default / Zero-Setup)**:
   - When `DATABASE_URL` is omitted, SoulCut stores all jobs, memories, feedback, and user data in an ultra-fast in-memory store.
   - Ideal for instant testing, demos, and local development with zero database setup required.
2. **Persistent MySQL (Production)**:
   - To persist state permanently across server restarts in production, provide a MySQL connection string (e.g. AWS RDS, TiDB Cloud, PlanetScale, or local MySQL).
   - Set `DATABASE_URL=mysql://user:pass@host:3306/soulcut` in `.env`.

---

## 6. Supported Video & Transcript Formats

| Format | Extension / Source | Description |
| :--- | :--- | :--- |
| **YouTube URLs** | `https://youtube.com/watch?v=...`, `https://youtu.be/...` | Public YouTube videos and podcasts |
| **Plain Text** | `.txt` | Plain text transcript files |
| **SubRip Subtitles** | `.srt` | Standard SubRip subtitle files with timestamped blocks |
| **WebVTT** | `.vtt` | Web Video Text Tracks format |

---

## 7. Running Tests & Quality Checks

SoulCut includes a comprehensive Vitest test suite covering unit, integration, and UI component tests:

```bash
# Run full test suite
npm test

# Run TypeScript typecheck
npm run check

# Build production bundle
npm run build
```
