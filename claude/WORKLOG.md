# Vera — Work Log

---

## 2026-04-10
### Entry #6 — Phase 6: Audio Recording & Upload

Browser audio recording with MediaRecorder API, auto-upload to backend, and full playback. 103 total tests passing (59 server + 44 web).

**Backend (`packages/server`):**
- Installed `multer` v2 for multipart file handling
- Created `uploads/` directory (gitignored)
- `POST /api/sessions/:id/upload-audio` — accepts `audio` field, saves to `./uploads/{sessionId}.webm`, updates `audioFileUrl`, transitions session status to `TRANSCRIBING`, creates `AUDIO_CAPTURED` audit event in `$transaction`
- Returns updated session with patient + physician includes

**Frontend (`packages/web`):**
- `src/lib/api.ts` — added `uploadFile(path, FormData)` method (no Content-Type header so browser sets multipart boundary automatically)
- `src/hooks/useAudioRecorder.ts` — custom hook exposing `startRecording`, `stopRecording`, `isRecording`, `duration` (seconds), `audioBlob`, `error`. Uses `MediaRecorder` with `audio/webm` (falls back to `audio/ogg`). Timer via `setInterval`.
- `src/components/audio/AudioRecorder.tsx` — three visual states: idle (Start Recording btn), recording (pulsing red dot + MM:SS timer + Stop btn), post-recording (auto-upload → playback `<audio>` element). Shows upload progress and success/error states.
- `src/pages/ActiveVisitPage.tsx` — now fetches session data (`GET /api/sessions/:id`), shows patient name, formatted date, StatusBadge, and the real AudioRecorder. AuditTimeline reads from `session.auditEvents`.

**Tests:**
- `packages/server/src/__tests__/sessions.test.ts` — 5 new tests: file saved + session updated, audit event created, 400 on missing file, 404 on bad session ID, 401 without auth
- `packages/web/src/__tests__/audioRecorder.test.tsx` — 11 tests across 5 describe blocks: idle state (Start Recording btn, no controls shown), recording state (01:05 timer, Stop btn, indicator), upload success (audio player visible), upload error (error message), mic error (error message from hook)

**Key bugs fixed:**
- `await waitFor(() => expect(...))` needed for async upload state assertions — `await act(async () => { render() })` alone doesn't wait for nested async Promises in useEffect
- `vi.hoisted()` again used for stable mock references in `audioRecorder.test.tsx` (same infinite re-render issue pattern as routing tests)
- `URL.createObjectURL` stubbed via `Object.defineProperty` in `beforeAll` since jsdom doesn't implement it

**Key files:**
- `packages/server/src/routes/sessions.ts` (added upload route)
- `packages/server/src/__tests__/sessions.test.ts` (added 5 upload tests)
- `packages/web/src/lib/api.ts`
- `packages/web/src/hooks/useAudioRecorder.ts`
- `packages/web/src/components/audio/AudioRecorder.tsx`
- `packages/web/src/pages/ActiveVisitPage.tsx`
- `packages/web/src/__tests__/audioRecorder.test.tsx`

---

## 2026-04-10
### Entry #5 — Phase 5: Patient Management & Session Creation

Full patient CRUD + session routes on the backend, and real data-driven frontend pages. 87 total tests passing (54 server + 33 web).

**Backend routes (`packages/server/src/routes/`):**
- `patients.ts` — POST (create, validates fullName), GET (search by name/MRN, case-insensitive), GET /:id (404 if not found), PUT /:id (partial update)
- `sessions.ts` — POST (requires patientId, creates session + SESSION_CREATED audit event in `$transaction`), GET (physician-scoped, optional `?status=` filter), GET /:id (full includes: patient, physician, transcript, soapNote, auditEvents asc)
- `src/lib/getPhysician.ts` — helper used by session routes to look up Physician by Clerk ID

**Frontend pages (`packages/web/src/pages/`):**
- `NewVisitPage.tsx` — debounced patient search (300ms, GET /api/patients?search=), dropdown results, inline patient creation form (fullName required, MRN + DOB optional), "Start Visit" → POST /api/sessions → navigate to /visits/:id
- `DashboardPage.tsx` — real session data (GET /api/sessions), stat cards (this week / pending review / completed), VisitCard list (5 most recent), empty state CTA
- `PastVisitsPage.tsx` — full session list with client-side search (patient name + MRN) and status filter buttons (All / Recording / In Review / Completed)

**Frontend components (`packages/web/src/components/visit/`):**
- `StatusBadge.tsx` — color-coded badge (blue=RECORDING, amber=TRANSCRIBING, purple=GENERATING_NOTE, orange=IN_REVIEW, green=COMPLETED). `data-testid="status-badge"` + `data-status` attrs.
- `VisitCard.tsx` — clickable card → /visits/:id. Shows patient name, formatted date, StatusBadge. Falls back to "Unknown Patient".
- `src/lib/types.ts` — shared TypeScript interfaces: Patient, Session, SessionStatus, WorkflowStatus, Transcript, SoapNote, AuditEvent, Physician

**Tests:**
- `packages/server/src/__tests__/patients.test.ts` — 15 tests: CRUD, search (name, MRN, case-insensitive), empty results, 400/404 errors
- `packages/server/src/__tests__/sessions.test.ts` — 15 tests: create + audit event, invalid inputs, no physician profile, list (ordering, status filter, isolation), get (full relations, audit ordering, 404, 403)
- `packages/web/src/__tests__/components.test.tsx` — 15 tests: StatusBadge (5 statuses, color classes, data attrs, className prop), VisitCard (patient name, date, status badge, unknown patient fallback, aria-label)
- `packages/web/src/__tests__/routing.test.tsx` — 18 tests (all async with `await act(async () => {})`)

**Key bugs fixed:**
- `useApi()` mock causing infinite re-render loop in tests: mock returned new function references on each call → `useEffect([get])` re-fired every render → `setSessions([])` triggered re-render with new `[]` reference → repeat. Fixed with `vi.hoisted()` to create stable mock function references shared across all renders.
- Routing tests hanging: never-resolving promise mocks kept the event loop alive; `Promise.resolve([])` + stable refs + async act() is the correct pattern.

**Key files:**
- `packages/server/src/routes/patients.ts`
- `packages/server/src/routes/sessions.ts`
- `packages/server/src/__tests__/patients.test.ts`
- `packages/server/src/__tests__/sessions.test.ts`
- `packages/web/src/lib/types.ts`
- `packages/web/src/lib/api.ts`
- `packages/web/src/pages/NewVisitPage.tsx`
- `packages/web/src/pages/DashboardPage.tsx`
- `packages/web/src/pages/PastVisitsPage.tsx`
- `packages/web/src/components/visit/StatusBadge.tsx`
- `packages/web/src/components/visit/VisitCard.tsx`
- `packages/web/src/__tests__/components.test.tsx`
- `packages/web/src/__tests__/routing.test.tsx`

---

## 2026-04-10
### Entry #4 — Phase 4: Frontend Shell & Navigation

Built full app layout, routing, and placeholder pages. 42 total tests passing (18 new web tests).

**Layout components (`src/components/layout/`):**
- `AppLayout.tsx` — three-column shell: fixed sidebar | scrollable main | optional right panel. `title` prop sets top-bar h1. `rightPanel` prop enables the right column + History toggle button.
- `Sidebar.tsx` — fixed left nav (240px). Brand mark at top, NavLink items (Dashboard, Past Visits, Settings) with blue active state, "Start New Visit" button → `/visits/new`, Clerk UserButton at bottom.
- `RightPanel.tsx` — "Audit & Version History" column (288px). Mobile overlay + desktop inline. Close button. Accepts children (placeholder or real audit content). Controlled open/close via props.

**Pages:**
- `DashboardPage` — welcome heading, 3 stat cards (placeholders), "Start New Visit" CTA, recent visits empty state
- `NewVisitPage` — heading + patient selection placeholder
- `ActiveVisitPage` — full three-column layout (right panel with audit placeholder), audio/transcript/SOAP panels as dashed-border placeholders, disabled action buttons
- `PastVisitsPage` — search bar placeholder + empty state
- `SettingsPage` — profile form placeholder (Full Name, Email, Credentials)

**Routing (`App.tsx`):**
- `AuthenticatedRoutes` component wraps all app routes inside `AuthSync`
- Routes: `/` → Dashboard, `/visits/new` → New Visit, `/visits/:id` → Active Visit, `/visits` → Past Visits, `/settings` → Settings
- `LandingPage.tsx` removed (replaced by DashboardPage)

**Tests (`src/__tests__/routing.test.tsx`):**
- 18 tests: page rendering, AppLayout structure (3 columns, toggle), Sidebar nav links + hrefs, ActiveVisitPage right panel
- Clerk mocked via `vi.mock("@clerk/clerk-react")` — no credentials needed
- AuthSync mocked to avoid API calls
- Key lesson: use `getByRole("heading", { level: 2, name: ... })` when AppLayout renders both an h1 (top bar) and h2 (page body) with the same text

**Testing setup (`packages/web`):**
- Installed: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- `vite.config.ts` — added `test: { globals: true, environment: "jsdom", setupFiles: ... }`
- `src/setupTests.ts` — imports `@testing-library/jest-dom`
- `package.json` — added `"test": "vitest run"` script

**Key files:**
- `packages/web/src/components/layout/AppLayout.tsx`
- `packages/web/src/components/layout/Sidebar.tsx`
- `packages/web/src/components/layout/RightPanel.tsx`
- `packages/web/src/pages/{Dashboard,NewVisit,ActiveVisit,PastVisits,Settings}Page.tsx`
- `packages/web/src/App.tsx`
- `packages/web/src/__tests__/routing.test.tsx`

---

## 2026-04-10
### Entry #3 — Phase 3: Authentication

Wired Clerk into backend and frontend. 24/24 tests passing.

**Backend (`packages/server`):**
- Installed `@clerk/express`
- `src/middleware/auth.ts` — `clerkInit` (global, parses tokens) + `requireAuthMiddleware` (rejects 401 on all `/api/*` except health)
- Health endpoint moved to register **before** `clerkMiddleware()` — fully public, never touched by Clerk
- `src/routes/auth.ts` — `POST /api/auth/sync`: finds or creates Physician from Clerk user data (name + primary email)
- `src/lib/getPhysician.ts` — `getPhysician(clerkId)` helper for use in future route handlers
- `packages/server/.env` — added `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` placeholders

**Frontend (`packages/web`):**
- Installed `@clerk/clerk-react` and `react-router-dom`
- `src/App.tsx` — `ClerkProvider` wrapping full app, React Router with `/sign-in/*`, `/sign-up/*`, and protected `/*` routes; unauthenticated users redirected to `/sign-in`
- `src/components/AuthSync.tsx` — calls `POST /api/auth/sync` once after sign-in (guarded by `useRef` to prevent double-fire)
- `src/lib/api.ts` — `useApi()` hook: fetch wrapper that attaches Clerk Bearer token to every request
- `src/pages/LandingPage.tsx` — added `<UserButton afterSignOutUrl="/sign-in" />` in header
- `tsconfig.json` — added `"types": ["vite/client"]` for `import.meta.env` access
- `packages/web/.env` — added `VITE_CLERK_PUBLISHABLE_KEY` placeholder

**Tests (`src/__tests__/auth.test.ts`):**
- `@clerk/express` fully mocked via `vi.mock` — no real Clerk credentials needed
- Mock `requireAuth` reads `x-test-clerk-user-id` header to simulate auth
- 7 tests: health stays public, unauthenticated 401s, sync creates physician, sync is idempotent, name edge cases (single name, no name → falls back to email)

**Bugs fixed during implementation:**
- Health endpoint was failing in tests because `clerkMiddleware()` validated `CLERK_PUBLISHABLE_KEY` even for public routes — fixed by registering health before `clerkInit`
- `fullName` fallback used `email` before it was declared — fixed variable ordering

**Key files:**
- `packages/server/src/middleware/auth.ts`
- `packages/server/src/routes/auth.ts`
- `packages/server/src/lib/getPhysician.ts`
- `packages/server/src/__tests__/auth.test.ts`
- `packages/web/src/App.tsx`
- `packages/web/src/components/AuthSync.tsx`
- `packages/web/src/lib/api.ts`

---

## 2026-04-10
### Entry #2 — Phase 2: Database & Prisma Setup

Installed Prisma v6, wrote the full schema, ran the migration, seeded demo data, and verified with 17 passing tests.

**What was done:**
- Installed `prisma` + `@prisma/client` (v6) in `packages/server`
- Ran `prisma init` — produces `prisma/schema.prisma` + `prisma.config.ts` (v6 format)
- Wrote full schema: `Physician`, `Patient`, `Session`, `Transcript`, `SoapNote`, `AuditEvent` + `SessionStatus` and `WorkflowStatus` enums
- Ran `prisma migrate dev --name initial-schema` — all tables created in local `vera` PostgreSQL database
- Client generated to `src/generated/prisma/` (Prisma v6 output path)
- Seed script creates: 1 physician (Dr. Sarah Smith, MD), 3 patients (James Okafor, Maria Chen, Robert Patel)
- Seed config moved to `prisma.config.ts` (v6 — `package.json#prisma` is deprecated)
- Created `src/lib/prisma.ts` — singleton PrismaClient

**Tests (`src/__tests__/database.test.ts`):**
- 16 integration tests across all 6 models + relationships
- Covers: creation, unique constraints, enum transitions, one-to-one enforcement, nested includes, multi-session physician
- All 17 tests pass (16 DB + 1 health)

**Prisma v6 notes:**
- Generator: `prisma-client` (not `prisma-client-js`)
- Output: `src/generated/prisma/client.ts` (import from `../generated/prisma/client`)
- Seed command: `prisma.config.ts` `seed.run` field (not `package.json#prisma`)
- Seed scripts need `import "dotenv/config"` — CLI config doesn't propagate env to ts-node

**Key files:**
- `packages/server/prisma/schema.prisma`
- `packages/server/prisma/seed.ts`
- `packages/server/prisma.config.ts`
- `packages/server/src/lib/prisma.ts`
- `packages/server/src/__tests__/database.test.ts`
- `packages/server/src/generated/prisma/` (generated — gitignored)

---

## 2026-04-10
### Entry #1 — Phase 1: Project Scaffolding

Set up full monorepo with npm workspaces and verified both servers run.

**Backend (`packages/server`):**
- Node.js + Express + TypeScript with `ts-node-dev` hot reload
- Strict `tsconfig.json`
- `GET /api/health` → `{ status: "ok", timestamp: <ISO> }`
- Basic Express 404 + global error handler
- Vitest + Supertest health endpoint test (passing)

**Frontend (`packages/web`):**
- React 18 + TypeScript + Vite
- Tailwind CSS with CSS variables (shadcn/ui theme tokens)
- `components.json` for shadcn/ui CLI (ready for component generation)
- `lib/utils.ts` with `cn()` helper
- Landing page: "Vera" / "Where medical documentation meets trust"

**Root:**
- `package.json` with npm workspaces (`packages/*`)
- `npm run dev` via `concurrently` starts both servers
- `.env.example` with all required env vars

**Key files:**
- `package.json` — workspace root + dev script
- `packages/server/src/index.ts` — Express app (exported for testing)
- `packages/server/src/__tests__/health.test.ts` — health test
- `packages/server/tsconfig.json`
- `packages/web/src/pages/LandingPage.tsx`
- `packages/web/tailwind.config.ts`, `postcss.config.js`, `components.json`
- `.env.example`
