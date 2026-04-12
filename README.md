# Vera — AI-Powered Medical SOAP Note Generator

Vera is a web-based medical documentation platform that automates the creation of SOAP notes from physician-patient visit recordings. A physician records a visit, Vera transcribes the audio with speaker identification, generates a structured SOAP note using AI, and the physician reviews, edits, and finalizes the note — replacing a manual process that typically takes 10–15 minutes per visit.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | Clerk |
| **Transcription** | AssemblyAI (speaker diarization built-in) |
| **SOAP Generation** | DeepSeek via OpenAI-compatible SDK |
| **Monorepo** | npm workspaces (`packages/server`, `packages/web`) |

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ running locally (default: `localhost:5432`)
- A [Clerk](https://clerk.com) application (free tier)
- An [AssemblyAI](https://www.assemblyai.com) API key (free tier)
- A [DeepSeek](https://platform.deepseek.com) API key (or any OpenAI-compatible provider)

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd vera
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in the values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vera

# Clerk Auth (from your Clerk dashboard)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# AssemblyAI — transcription + speaker diarization
ASSEMBLYAI_API_KEY=...

# LLM for SOAP generation (OpenAI-compatible — swap provider by changing these)
LLM_API_KEY=...
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

# Frontend (separate env file in packages/web)
# VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Also create `packages/web/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

> **Tip:** The LLM provider is fully swappable. To use GPT-4o instead of DeepSeek, set `LLM_BASE_URL=https://api.openai.com/v1` and `LLM_MODEL=gpt-4o`.

### 3. Set up the database

Create the PostgreSQL database:

```bash
createdb vera
```

Run migrations:

```bash
cd packages/server
npx prisma migrate dev
```

Seed demo data (creates demo physician, patients, and a completed sample visit):

```bash
npx prisma db seed
```

### 4. Run the app

From the project root:

```bash
npm run dev
```

This starts both servers concurrently:
- **Backend:** http://localhost:3001
- **Frontend:** http://localhost:5173

---

## Demo Walkthrough

After seeding, you'll have:
- A demo physician record (`Dr. Sarah Smith, MD`)
- Three demo patients (`James Okafor`, `Maria Chen`, `Robert Patel`)
- One fully completed demo visit (James Okafor — cough encounter) with transcript, approved SOAP note, and full audit trail

### End-to-end flow

1. **Sign up** at `/sign-up` — creates your physician account
2. **Dashboard** — see stats and recent visits; the seeded demo visit appears immediately
3. **Start New Visit** — select or create a patient, navigate to the active visit workspace
4. **Record** — click "Start Recording", speak the encounter, click "Stop Recording"
5. **Transcription** — audio uploads automatically, then AssemblyAI transcribes with speaker labels (Doctor/Patient)
6. **SOAP Generation** — transcription chains directly into SOAP note generation via DeepSeek
7. **Review & Edit** — edit any SOAP section inline (Subjective, Objective, Assessment, Plan)
8. **Save Draft** — preserve your edits
9. **Request Review** — transitions note to Pending Review status
10. **Sign & Finalize** — approve the note (irreversible); session moves to Completed
11. **Audit Trail** — right panel shows every event with timestamps and author
12. **Past Visits** — search and filter all completed sessions

### Viewing the demo completed visit

Navigate to Past Visits and click the seeded James Okafor entry to see:
- A realistic speaker-labeled transcript
- A fully approved SOAP note with all four sections
- The complete audit trail from audio capture through final approval

---

## Project Structure

```
vera/
├── packages/
│   ├── server/                # Express backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── routes/        # patients, sessions, soapNotes, auditEvents
│   │       ├── services/      # transcription.ts, soapGeneration.ts
│   │       ├── middleware/    # auth.ts (Clerk)
│   │       └── lib/           # prisma.ts, getPhysician.ts
│   └── web/                   # React frontend
│       └── src/
│           ├── components/    # layout, audio, transcript, soap, audit, ui
│           ├── pages/         # Dashboard, NewVisit, ActiveVisit, PastVisits, Settings
│           ├── hooks/         # useAudioRecorder
│           └── lib/           # api.ts (fetch wrapper), types.ts
├── .env.example
└── README.md
```

---

## Running Tests

```bash
# Backend tests
cd packages/server
npm test

# Frontend tests
cd packages/web
npm test
```

All tests run against a real PostgreSQL test database (no mocking of the DB layer). Ensure `DATABASE_URL` is set in the environment before running server tests.

---

## Key Design Decisions

- **Post-recording transcription** — audio is uploaded after recording stops, not streamed live. Simpler and sufficient for the use case.
- **AssemblyAI over Whisper** — built-in diarization (speaker labels) in a single API call. Whisper alone has no diarization.
- **OpenAI-compatible LLM interface** — swap from DeepSeek to GPT-4o or any other provider by changing two env vars.
- **Local filesystem storage** — audio files stored on disk for demo simplicity. Swap to S3 by changing the upload handler.
- **Clerk for auth** — zero-config auth. Physician record auto-created on first login via `POST /api/auth/sync`.
