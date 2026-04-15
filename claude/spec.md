# Vera — Technical Specification & Implementation Plan

## Status: Completed
## 1. Product Overview

**Vera** is a web-based medical documentation platform that automates the creation of SOAP notes from physician-patient visit recordings. A physician records a visit, Vera transcribes the audio with speaker identification, generates a structured SOAP note using AI, and the physician reviews, edits, and finalizes the note — replacing a manual process that typically takes 10-15 minutes per visit.

**Target user:** Physicians in outpatient/clinic settings who document patient encounters as SOAP notes.

**Core value proposition:** Record the visit, get a draft SOAP note in under a minute, review and sign off.

---

## 2. MVP Feature Set

### In Scope

| Feature | Description |
|---|---|
| **Audio Recording** | Browser-based microphone capture via MediaRecorder API. Record a full visit, then upload for processing (not real-time streaming). |
| **Post-Recording Transcription** | After recording completes, audio is sent to a transcription API that returns a full transcript with speaker labels (diarization). |
| **SOAP Note Generation** | Diarized transcript is sent to an LLM (DeepSeek by default) with a medical SOAP prompt. Returns structured Subjective, Objective, Assessment, Plan sections. |
| **Physician Review & Editing** | Physician views the generated SOAP note, edits any section inline, and transitions it through a workflow: Draft → Pending Review → Approved. |
| **Audit & Version History** | Every significant event (audio captured, transcript generated, SOAP created, edits made, note approved) is logged with timestamps and displayed as a timeline. |
| **Visit Management** | Dashboard showing all visits (active and past), ability to start a new visit, view past visits and their notes. |
| **Authentication** | Simple auth flow so each physician has their own account and visit history. |

### Out of Scope (MVP)

- Real-time live transcription via WebSocket streaming
- Multi-physician collaboration / shared patients across providers
- EHR integration (FHIR, HL7)
- HIPAA-compliant infrastructure (encryption at rest, BAAs, audit logging for compliance)
- Patient portal / patient-facing features
- Mobile app
- PDF export of signed notes (future enhancement)
- Billing code suggestions

---

## 3. Technical Architecture

### Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Fast dev iteration, strong typing, modern tooling. |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid UI development with consistent, professional components. |
| **Backend** | Node.js + Express + TypeScript | Matches frontend language, straightforward REST API. |
| **Database** | PostgreSQL + Prisma ORM | Relational data with clear schema, Prisma provides type-safe queries and easy migrations. |
| **Auth** | Clerk | Zero-config auth with React SDK, handles login/signup/session out of the box. Minimal setup for a demo. |
| **Transcription** | AssemblyAI API | Provides transcription + speaker diarization in a single API call. Simpler than Whisper (which lacks native diarization) and has a generous free tier. |
| **SOAP Generation** | DeepSeek API (via OpenAI SDK) | Cost-effective for structured note generation. Uses OpenAI-compatible API, so swapping to Claude, GPT, or any other provider is a one-line config change (`baseURL` + `model`). |
| **File Storage** | Local filesystem (demo) | Audio files stored on the server's disk. No S3 dependency for MVP. Straightforward to swap to S3 later. |

### Architecture Note: Why AssemblyAI over Whisper

The original architecture specified OpenAI Whisper for transcription. For the MVP, AssemblyAI is recommended instead because:

1. **Built-in diarization** — Whisper only does transcription. Getting speaker labels requires pairing Whisper with a separate diarization model (pyannote-audio), which adds significant complexity (Python service, GPU considerations, alignment logic).
2. **Single API call** — Send audio to AssemblyAI, get back a transcript with speaker labels. No orchestration needed.
3. **Free tier** — Generous free credits, more than enough for demo purposes.
4. **Easy swap** — The transcription service is behind an abstraction layer. Switching to Whisper + diarization or Deepgram later is a backend-only change.

### Architecture Note: OpenAI-Compatible SOAP Generation

The SOAP generation service is built against the OpenAI SDK interface (`openai` npm package). DeepSeek and most major providers (Anthropic via proxy, Groq, Together, Mistral) expose OpenAI-compatible endpoints. Swapping providers requires changing only two config values — `baseURL` and `model` — with zero code changes:

```typescript
// DeepSeek (default — cheap, good for iteration)
{ baseURL: "https://api.deepseek.com", model: "deepseek-chat" }

// OpenAI (if you want GPT-4o)
{ baseURL: "https://api.openai.com/v1", model: "gpt-4o" }

// Groq (fast inference)
{ baseURL: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" }
```

This makes it easy to experiment with quality vs. cost tradeoffs during development.

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TS)                     │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │Dashboard │  │ Active   │  │  Past    │  │  Settings  │  │
│  │  View    │  │  Visit   │  │  Visits  │  │            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│       │              │              │                        │
│       └──────────────┴──────────────┘                       │
│                      │                                      │
│              REST API calls (fetch)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────┴──────────────────────────────────────┐
│                Backend (Node + Express + TS)                 │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  REST API    │  │  Auth        │  │  AI Pipeline      │  │
│  │  Routes      │  │  Middleware  │  │  (Transcribe +    │  │
│  │              │  │  (Clerk)     │  │   Generate SOAP)  │  │
│  └──────┬───────┘  └──────────────┘  └────────┬──────────┘  │
│         │                                      │            │
│  ┌──────┴───────┐                    ┌────────┴──────────┐  │
│  │  Prisma ORM  │                    │  External APIs    │  │
│  └──────┬───────┘                    │  - AssemblyAI     │  │
│         │                            │  - DeepSeek (LLM) │  │
│  ┌──────┴───────┐                    └───────────────────┘  │
│  │  PostgreSQL  │                                           │
│  └──────────────┘                                           │
│                                                             │
│  ┌──────────────┐                                           │
│  │  Local FS    │  (audio file storage)                     │
│  │  /uploads    │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### Prisma Models

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Physician {
  id          String    @id @default(uuid())
  clerkId     String    @unique          // Links to Clerk auth user
  fullName    String
  email       String    @unique
  credentials String?                    // e.g., "MD", "DO"
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  sessions    Session[]
  approvedNotes SoapNote[] @relation("ApprovedBy")
}

model Patient {
  id          String    @id @default(uuid())
  fullName    String
  dateOfBirth DateTime?
  mrn         String?   @unique          // Medical Record Number
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  sessions    Session[]
}

model Session {
  id           String        @id @default(uuid())
  physicianId  String
  patientId    String
  status       SessionStatus @default(RECORDING)
  recordedAt   DateTime      @default(now())
  audioFileUrl String?                   // Local path to audio file
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  physician    Physician     @relation(fields: [physicianId], references: [id])
  patient      Patient       @relation(fields: [patientId], references: [id])
  transcript   Transcript?
  soapNote     SoapNote?
  auditEvents  AuditEvent[]
}

enum SessionStatus {
  RECORDING
  TRANSCRIBING
  GENERATING_NOTE
  IN_REVIEW
  COMPLETED
}

model Transcript {
  id              String   @id @default(uuid())
  sessionId       String   @unique
  rawDiarizedText String                 // Full transcript with speaker labels (JSON)
  plainText       String                 // Plain text version for display
  generatedAt     DateTime @default(now())

  session         Session  @relation(fields: [sessionId], references: [id])
}

model SoapNote {
  id             String         @id @default(uuid())
  sessionId      String         @unique
  subjective     String                  // S section text
  objective      String                  // O section text
  assessment     String                  // A section text
  plan           String                  // P section text
  workflowStatus WorkflowStatus @default(DRAFT)
  approvedAt     DateTime?
  approvedById   String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  session        Session        @relation(fields: [sessionId], references: [id])
  approvedBy     Physician?     @relation("ApprovedBy", fields: [approvedById], references: [id])
}

enum WorkflowStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
}

model AuditEvent {
  id          String   @id @default(uuid())
  sessionId   String
  eventType   String               // e.g., "AUDIO_CAPTURED", "TRANSCRIPT_GENERATED", etc.
  description String?
  author      String               // "System", "AI Engine", or physician name
  metadata    Json?                // Flexible field for extra data (e.g., which fields were edited)
  createdAt   DateTime @default(now())

  session     Session  @relation(fields: [sessionId], references: [id])
}
```

### Key Relationships

- **Physician → Sessions**: One physician has many sessions.
- **Patient → Sessions**: One patient can have many sessions across visits.
- **Session → Transcript**: One-to-one. A session produces exactly one transcript.
- **Session → SoapNote**: One-to-one. A session produces exactly one SOAP note.
- **Session → AuditEvents**: One-to-many. Every action on a session is logged.

---

## 5. API Design

### Auth Middleware

All routes (except health check) are protected by Clerk middleware. The middleware extracts the Clerk user ID from the session token and resolves it to a `Physician` record.

### Endpoints

#### Patients

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/patients` | Create a new patient record |
| `GET` | `/api/patients` | List all patients (with search by name/MRN) |
| `GET` | `/api/patients/:id` | Get a single patient |
| `PUT` | `/api/patients/:id` | Update patient info |

#### Sessions

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/sessions` | Create a new session (requires patientId) |
| `GET` | `/api/sessions` | List sessions for the authenticated physician (filterable by status) |
| `GET` | `/api/sessions/:id` | Get full session detail (includes transcript, SOAP note, audit events) |
| `POST` | `/api/sessions/:id/upload-audio` | Upload audio file (multipart/form-data). Stores file, updates session. |
| `POST` | `/api/sessions/:id/transcribe` | Triggers transcription pipeline. Sends audio to AssemblyAI, stores result. |
| `POST` | `/api/sessions/:id/generate-soap` | Triggers SOAP generation. Sends transcript to LLM, stores result. |

#### SOAP Notes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/sessions/:id/soap-note` | Get the SOAP note for a session |
| `PUT` | `/api/sessions/:id/soap-note` | Update SOAP note sections (physician edits) |
| `POST` | `/api/sessions/:id/soap-note/submit-review` | Transition status to PENDING_REVIEW |
| `POST` | `/api/sessions/:id/soap-note/approve` | Transition status to APPROVED, set approvedAt/approvedBy |

#### Audit Events

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/sessions/:id/audit-events` | Get all audit events for a session (ordered by createdAt) |

#### Utility

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Health check (no auth required) |

---

## 6. AI Pipeline

### Step 1: Transcription (AssemblyAI)

After audio upload, the backend sends the audio file to AssemblyAI's transcription endpoint with speaker diarization enabled.

**Request configuration:**
```typescript
import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

const transcript = await client.transcripts.transcribe({
  audio: audioFilePath,           // local file path or URL
  speaker_labels: true,           // Enable speaker diarization
});
```

**Processing the response:**

AssemblyAI returns utterances with speaker labels (e.g., "A", "B"). The backend maps these to "Doctor" and "Patient" labels. Heuristic: the first speaker is typically the physician (first to speak in a clinical setting). This mapping is stored in the transcript's `rawDiarizedText` as structured JSON, and a formatted `plainText` version is generated for display.

```typescript
// AssemblyAI returns utterances like:
// transcript.utterances = [
//   { speaker: "A", text: "Good morning...", start: 0, end: 2500 },
//   { speaker: "B", text: "Not great...", start: 3000, end: 6200 },
// ]

// Mapped and stored in rawDiarizedText as:
{
  "utterances": [
    { "speaker": "Doctor", "text": "Good morning. How are you feeling today?", "start": 0.0, "end": 2.5 },
    { "speaker": "Patient", "text": "Not great. I've had this persistent cough for two weeks.", "start": 3.0, "end": 6.2 },
    ...
  ]
}
```

### Step 2: SOAP Note Generation (DeepSeek via OpenAI SDK)

The formatted transcript is sent to DeepSeek (or any OpenAI-compatible provider) with a system prompt that instructs structured SOAP note output.

**System prompt (core):**
```
You are a medical scribe AI assistant. Given a transcript of a physician-patient 
encounter with speaker labels, generate a structured SOAP note.

Output a JSON object with exactly four keys: "subjective", "objective", "assessment", "plan".

Guidelines:
- **Subjective**: Chief complaint, history of present illness (HPI), review of systems 
  as reported BY THE PATIENT. Use the patient's own language where clinically relevant.
- **Objective**: Any physical exam findings, vitals, or observations mentioned BY THE 
  PHYSICIAN during the encounter. If none are explicitly stated, write "No objective 
  findings documented in this encounter."
- **Assessment**: The physician's clinical impression or differential diagnosis as 
  discussed in the encounter.
- **Plan**: Treatment plan, medications, follow-up instructions, referrals, or next 
  steps as stated by the physician.

Do not hallucinate findings not present in the transcript.
Do not infer diagnoses beyond what the physician explicitly discussed.
Respond ONLY with the JSON object, no additional text.
```

**Request:**
```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com",
});

const response = await client.chat.completions.create({
  model: process.env.LLM_MODEL || "deepseek-chat",
  messages: [
    { role: "system", content: SOAP_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Generate a SOAP note from the following physician-patient encounter transcript:\n\n${formattedTranscript}`
    }
  ],
  response_format: { type: "json_object" },  // Enforce JSON output
});

const soapNote = JSON.parse(response.content[0].text);
```

---

## 7. Frontend Structure

### Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/sign-in` | Sign In | Clerk-hosted sign-in component |
| `/sign-up` | Sign Up | Clerk-hosted sign-up component |
| `/` | Dashboard | Overview: recent visits, quick stats, "Start New Visit" CTA |
| `/visits/new` | New Visit | Select/create patient, then begin recording |
| `/visits/:id` | Active Visit | Main workspace: audio recorder, transcript panel, SOAP note editor, audit timeline |
| `/visits` | Past Visits | Searchable/filterable list of all completed sessions |
| `/settings` | Settings | Physician profile, preferences |

### Active Visit Page — Layout (the core screen)

This is the primary workspace, matching the UX demo from the presentation:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar        │  Main Content                    │  Right Panel   │
│                 │                                   │                │
│  ┌───────────┐  │  Patient: Sarah Johnson           │  Audit &       │
│  │ Dashboard │  │  Feb 26, 2026 - 2:15 PM           │  Version       │
│  │ Active    │◄─│                                   │  History       │
│  │ Visit     │  │  ┌─────────────────────────────┐  │                │
│  │ Past      │  │  │  Audio Recording             │  │  ● Audio      │
│  │ Visits    │  │  │  [▶ waveform] 02:34          │  │    Captured   │
│  │ Settings  │  │  │  [ Start Recording ]          │  │  ● Transcript │
│  └───────────┘  │  └─────────────────────────────┘  │    Generated  │
│                 │                                   │  ● SOAP Draft  │
│                 │  ┌─────────────────────────────┐  │    Created    │
│                 │  │  Live Transcript              │  │  ● Edited by  │
│                 │  │  Doctor: Good morning...      │  │    Dr. Smith  │
│                 │  │  Patient: Not great...        │  │                │
│                 │  └─────────────────────────────┘  │                │
│                 │                                   │                │
│                 │  ┌─────────────────────────────┐  │                │
│                 │  │  SOAP Note                    │  │                │
│                 │  │  [S] [O] [A] [P] tabs/sections│  │                │
│                 │  │  (editable text areas)        │  │                │
│                 │  └─────────────────────────────┘  │                │
│                 │                                   │                │
│  [Start New     │  [Save Draft] [Request Review]    │  [Download     │
│   Visit]        │  [Sign & Finalize]                │   Signed PDF]  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Frontend Components

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx              # Navigation sidebar
│   │   ├── AppLayout.tsx            # Shared layout wrapper
│   │   └── RightPanel.tsx           # Audit history panel (collapsible)
│   ├── audio/
│   │   ├── AudioRecorder.tsx        # MediaRecorder controls + waveform visualization
│   │   └── AudioPlayer.tsx          # Playback for completed recordings
│   ├── transcript/
│   │   └── TranscriptViewer.tsx     # Speaker-labeled transcript display
│   ├── soap/
│   │   ├── SoapNoteEditor.tsx       # Editable S/O/A/P sections
│   │   └── SoapNoteViewer.tsx       # Read-only view for approved notes
│   ├── visit/
│   │   ├── VisitCard.tsx            # Visit summary card (for dashboard/list)
│   │   ├── NewVisitForm.tsx         # Patient selection + start session
│   │   └── StatusBadge.tsx          # Session status indicator
│   ├── audit/
│   │   └── AuditTimeline.tsx        # Vertical timeline of audit events
│   └── common/
│       ├── LoadingSpinner.tsx
│       └── ConfirmDialog.tsx
├── pages/
│   ├── DashboardPage.tsx
│   ├── NewVisitPage.tsx
│   ├── ActiveVisitPage.tsx          # The main workspace
│   ├── PastVisitsPage.tsx
│   └── SettingsPage.tsx
├── hooks/
│   ├── useAudioRecorder.ts          # MediaRecorder logic
│   ├── useSession.ts                # Fetch/manage session state
│   └── useSoapNote.ts               # SOAP note CRUD + workflow actions
├── lib/
│   ├── api.ts                       # API client (fetch wrapper with Clerk token)
│   └── types.ts                     # Shared TypeScript interfaces
└── App.tsx                          # Router + Clerk provider
```

---

## 8. Audio Recording Implementation

Since we're using post-recording (not live streaming), the audio flow is simple:

### Browser Recording

```typescript
// useAudioRecorder.ts — core logic
const useAudioRecorder = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      // blob is ready for upload
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
  };

  return { startRecording, stopRecording, ... };
};
```

### Upload Flow

1. Physician clicks "Stop Recording"
2. Audio blob is created from chunks
3. Frontend sends `POST /api/sessions/:id/upload-audio` with the blob as `multipart/form-data`
4. Backend saves file to `/uploads/{sessionId}.webm`
5. An `AUDIO_CAPTURED` audit event is created
6. Session status transitions to `TRANSCRIBING`

### Processing Pipeline (triggered after upload)

The frontend can trigger transcription and SOAP generation as sequential steps, or the backend can chain them automatically after upload. For the MVP, we'll chain them:

1. Audio uploaded → backend immediately calls AssemblyAI → stores transcript → audit event
2. Transcript stored → backend immediately calls DeepSeek → stores SOAP note → audit event
3. Session status transitions: `RECORDING → TRANSCRIBING → GENERATING_NOTE → IN_REVIEW`
4. Frontend polls or receives updated session state and renders results

---

## 9. Implementation Plan

Each phase produces a working increment. Designed for solo execution with Claude Code — each step has a clear entry point and deliverable.

---

### Phase 1: Project Scaffolding

**Goal:** Monorepo with backend and frontend that both run locally.

**Tasks:**
1. Initialize project root with `package.json` workspaces: `packages/server` and `packages/web`
2. **Backend:** Set up Node.js + Express + TypeScript with `ts-node-dev` for hot reload. Create a `/api/health` endpoint returning `{ status: "ok" }`.
3. **Frontend:** Scaffold React + TypeScript + Vite app. Install Tailwind CSS + shadcn/ui. Verify dev server runs.
4. Add a root `dev` script that starts both concurrently.
5. Add `.env.example` with placeholder values for all required env vars.

**Deliverable:** `npm run dev` starts both servers. Health endpoint responds. React app renders a "Hello Vera" page.

---

### Phase 2: Database & Prisma Setup

**Goal:** PostgreSQL schema is live, Prisma client is generated, seed data exists.

**Tasks:**
1. Install Prisma in the backend package. Initialize with `prisma init`.
2. Write the full schema (all models from Section 4 above).
3. Run `prisma migrate dev` to create tables.
4. Write a seed script (`prisma/seed.ts`) that creates:
   - 1 demo physician (will be linked to Clerk later)
   - 3 demo patients with different names/MRNs
5. Verify with `prisma studio` that data is visible.

**Deliverable:** Database is running with seed data. Prisma client is generated and importable.

---

### Phase 3: Authentication

**Goal:** Users can sign up, sign in, and the backend knows who's making requests.

**Tasks:**
1. Create a Clerk application (free tier). Get API keys.
2. **Frontend:** Install `@clerk/clerk-react`. Wrap app in `<ClerkProvider>`. Add `<SignIn>` and `<SignUp>` route components. Add a `<UserButton>` to the sidebar.
3. **Backend:** Install `@clerk/express`. Add Clerk middleware to protect all `/api/*` routes. Extract `userId` from Clerk session.
4. Create a `POST /api/auth/sync` endpoint: when a user signs in for the first time, create a `Physician` record linked to their Clerk ID. Frontend calls this after sign-in.
5. Add a helper `getPhysician(clerkId)` used by all protected routes.

**Deliverable:** Full sign-in/sign-up flow. Backend rejects unauthenticated requests. Physician record is auto-created on first login.

---

### Phase 4: Frontend Shell & Navigation

**Goal:** All pages exist with layout, routing, and navigation — filled with placeholder content.

**Tasks:**
1. Set up React Router with routes for: `/`, `/visits/new`, `/visits/:id`, `/visits`, `/settings`.
2. Build `AppLayout` component with the three-column structure: sidebar, main content, right panel.
3. Build `Sidebar` with nav links (Dashboard, Active Visit, Past Visits, Settings) + "Start New Visit" button.
4. Create placeholder pages for each route with appropriate headings.
5. Implement responsive behavior: right panel collapses on smaller screens.

**Deliverable:** Clicking through the sidebar navigates between all pages. Layout matches the UX demo structure.

---

### Phase 5: Patient Management & Session Creation

**Goal:** Physicians can create/select patients and start new visit sessions.

**Tasks:**
1. **Backend:** Implement patient CRUD endpoints (`POST`, `GET` list with search, `GET` by ID, `PUT`).
2. **Backend:** Implement `POST /api/sessions` (creates session with status `RECORDING`) and `GET /api/sessions` (list for current physician).
3. **Frontend:** Build `NewVisitPage` with a patient search/select dropdown + "Create New Patient" inline form. On submit, creates the session and navigates to `/visits/:id`.
4. **Frontend:** Build `DashboardPage` showing recent sessions as cards with patient name, date, and status badge.
5. **Frontend:** Build `PastVisitsPage` as a searchable list of all sessions.

**Deliverable:** Physician can create a patient, start a visit, and see it appear on the dashboard.

---

### Phase 6: Audio Recording & Upload

**Goal:** Physician can record audio in the browser and upload it to the server.

**Tasks:**
1. **Frontend:** Build `useAudioRecorder` hook using MediaRecorder API. Handle start, stop, elapsed time tracking, and blob creation.
2. **Frontend:** Build `AudioRecorder` component with start/stop button, timer display, and a simple waveform visualization (can use `AnalyserNode` from Web Audio API for a live amplitude bar, or a static waveform after recording).
3. **Backend:** Implement `POST /api/sessions/:id/upload-audio` with `multer` for file handling. Save to `./uploads/{sessionId}.webm`. Update session's `audioFileUrl`.
4. **Backend:** Create an `AUDIO_CAPTURED` audit event on successful upload.
5. **Frontend:** After recording stops, automatically upload the blob. Show upload progress. On success, display an audio playback element.

**Deliverable:** Physician clicks record, speaks, stops, audio uploads and is playable. Audit event is logged.

---

### Phase 7: Transcription Pipeline

**Goal:** Audio is transcribed with speaker diarization via AssemblyAI.

**Tasks:**
1. **Backend:** Install AssemblyAI SDK (`assemblyai`). Create a `TranscriptionService` class that takes an audio file path and returns structured transcript data.
2. **Backend:** Implement `POST /api/sessions/:id/transcribe`. Reads audio file, sends to AssemblyAI with `speaker_labels: true`, processes response into structured format, stores as `Transcript` record.
3. **Backend:** Map speaker labels ("A", "B") to "Doctor"/"Patient" labels. Store both the raw JSON (`rawDiarizedText`) and a formatted plain text version.
4. **Backend:** Create a `TRANSCRIPT_GENERATED` audit event. Update session status to `GENERATING_NOTE`.
5. **Frontend:** Build `TranscriptViewer` component that renders speaker-labeled turns with visual distinction (different colors/alignment for Doctor vs Patient).
6. **Frontend:** On the Active Visit page, after audio upload completes, trigger transcription. Show a loading state ("Transcribing...") and render the transcript when ready.

**Deliverable:** After recording, transcript appears with Doctor/Patient labels. Full pipeline: record → upload → transcribe → display.

---

### Phase 8: SOAP Note Generation

**Goal:** Transcript is sent to the LLM and a structured SOAP note is generated.

**Tasks:**
1. **Backend:** Install OpenAI SDK (`openai`). Create a `SoapGenerationService` class with the system prompt and generation logic. Configure with env vars (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`) so the provider is swappable.
2. **Backend:** Implement `POST /api/sessions/:id/generate-soap`. Retrieves transcript, sends to LLM with `response_format: { type: "json_object" }`, parses JSON response, stores as `SoapNote` with status `DRAFT`.
3. **Backend:** Add error handling: if the LLM returns malformed JSON, retry once. If still fails, store raw text and flag for manual review.
4. **Backend:** Create a `SOAP_DRAFT_CREATED` audit event. Update session status to `IN_REVIEW`.
5. **Frontend:** Build `SoapNoteEditor` component with four collapsible/tabbed sections (S, O, A, P), each as an editable textarea.
6. **Frontend:** Chain generation after transcription completes. Show loading state ("Generating SOAP note..."), then render the editor with the draft.

**Deliverable:** Full pipeline works end-to-end: record → upload → transcribe → generate SOAP → display editable note.

---

### Phase 9: Review & Approval Workflow

**Goal:** Physician can edit the SOAP note and transition it through Draft → Pending Review → Approved.

**Tasks:**
1. **Backend:** Implement `PUT /api/sessions/:id/soap-note` for saving edits to any SOAP section. Create a `SOAP_EDITED` audit event with metadata indicating which fields changed.
2. **Backend:** Implement `POST /api/sessions/:id/soap-note/submit-review` (status → `PENDING_REVIEW`). Audit event: `REVIEW_REQUESTED`.
3. **Backend:** Implement `POST /api/sessions/:id/soap-note/approve` (status → `APPROVED`, sets `approvedAt` and `approvedById`). Audit event: `NOTE_APPROVED`. Update session status to `COMPLETED`.
4. **Frontend:** Add action buttons below the SOAP editor: "Save Draft", "Request Review", "Sign & Finalize". Conditionally show based on current workflow status.
5. **Frontend:** In approved state, SOAP note becomes read-only (switch to `SoapNoteViewer`). Show a green "Approved" badge with approval timestamp.
6. **Frontend:** Add confirmation dialog for "Sign & Finalize" (irreversible action).

**Deliverable:** Physician can edit, save, submit for review, and approve a SOAP note. Status transitions are enforced and reflected in the UI.

---

### Phase 10: Audit Trail & Version History

**Goal:** Right panel displays a chronological timeline of all events for the current session.

**Tasks:**
1. **Backend:** Implement `GET /api/sessions/:id/audit-events` returning events ordered by `createdAt ASC`.
2. **Frontend:** Build `AuditTimeline` component — a vertical timeline with icons per event type, timestamps, and author labels. Match the visual style from the UX demo (colored badges: "Signed" in green, "Draft" in yellow).
3. **Frontend:** Wire into the `RightPanel` on the Active Visit page. Auto-refresh when session state changes (after transcription, SOAP generation, edits, approval).
4. Add a "View Full Version History" expandable section that shows all edit diffs (stretch goal — for MVP, just listing events with metadata is sufficient).

**Deliverable:** Right panel shows the full audit trail for any visit. Events appear in real-time as the physician works through the pipeline.

---

### Phase 11: Polish & Demo Prep

**Goal:** App is demo-ready with good error handling, loading states, and a clean walkthrough path.

**Tasks:**
1. Add loading skeletons/spinners for all async operations (upload, transcription, SOAP generation).
2. Add error toasts for failed API calls (using shadcn's `toast` component).
3. Add empty states for dashboard (no visits yet) and past visits (no completed sessions).
4. Create a "demo mode" seed: pre-populate a completed visit with transcript and approved SOAP note so the demo can show both the creation flow and a completed example.
5. Test the full end-to-end flow: sign in → create patient → start visit → record → auto-transcribe → auto-generate SOAP → edit → approve.
6. Add a brief README with setup instructions.

**Deliverable:** Polished, demo-ready app. One clean walkthrough path that showcases every feature.

---

## 10. Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vera

# Clerk Auth
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# AssemblyAI (transcription + diarization)
ASSEMBLYAI_API_KEY=...

# LLM for SOAP generation (OpenAI-compatible — swap provider by changing these)
LLM_API_KEY=...
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

# Server
PORT=3001
UPLOAD_DIR=./uploads
```

---

## 11. Project Structure (Final)

```
vera/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts                 # Express app entry point
│   │   │   ├── routes/
│   │   │   │   ├── patients.ts
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── soapNotes.ts
│   │   │   │   └── auditEvents.ts
│   │   │   ├── services/
│   │   │   │   ├── transcription.ts     # AssemblyAI integration
│   │   │   │   ├── soapGeneration.ts    # LLM integration (OpenAI SDK)
│   │   │   │   └── auditLog.ts          # Audit event creation helper
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts              # Clerk auth middleware
│   │   │   └── lib/
│   │   │       └── prisma.ts            # Prisma client singleton
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── uploads/                     # Audio file storage (gitignored)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/              # (as detailed in Section 7)
│       │   ├── pages/
│       │   ├── hooks/
│       │   └── lib/
│       ├── package.json
│       ├── tailwind.config.ts
│       ├── vite.config.ts
│       └── tsconfig.json
├── package.json                         # Workspace root
├── .env.example
├── CLAUDE.md                            # Claude Code session context
└── README.md
```

---