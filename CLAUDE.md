# Vera — AI-Powered Medical SOAP Note Generator

## What is this?
A web app where physicians record patient visits, get AI-generated SOAP notes from the 
transcript, then review and approve them.

## Stack
- Frontend: React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Auth: Clerk
- AI: AssemblyAI (transcription + diarization), DeepSeek via OpenAI SDK (SOAP generation)
- Monorepo with npm workspaces: packages/server, packages/web

## Current Phase
Phase 1: Project Scaffolding — COMPLETE
Phase 2: Database & Prisma Setup — COMPLETE
Phase 3: Authentication — COMPLETE
Phase 4: Frontend Shell & Navigation — COMPLETE
Phase 5: Patient Management & Session Creation — COMPLETE
Phase 6: Audio Recording & Upload — COMPLETE
Phase 7: Transcription Pipeline — COMPLETE
Phase 8: SOAP Note Generation — COMPLETE
Phase 9: Review & Approval Workflow — COMPLETE
Phase 10: Audit Trail & Version History — COMPLETE
Phase 11: Polish & Demo Prep — COMPLETE

## Project Status
All phases complete. The app is demo-ready.

**Read-only mode on Active Visit page (non-owner view) — COMPLETE** (`claude/dashboard-visibility-feat.md` §3):
- ✅ New `GET /api/auth/me` endpoint + `useCurrentPhysician` hook resolve the logged-in physician's id for client-side ownership checks.
- ✅ `ActiveVisitPage` derives `isOwner` optimistically (treats unresolved `/auth/me` as "owner" to avoid read-only flash for owners). When `knownNonOwner`, renders `OwnershipBanner` naming the owning physician and gates every write control.
- ✅ `AudioRecorder` accepts `readOnly`; hides Start/Stop buttons and shows an "in read-only mode" placeholder. `VitalsDisplay.onEdit` is now optional — non-owners see values only, no edit button. `VitalsForm` is never rendered for non-owners. `SoapNoteEditor` receives `readOnly={isApproved || !isOwner}`. `SoapWorkflowActions` only renders for owners.
- ✅ 403 responses from any write action surface a "You can only modify sessions you created." toast (helper: `isForbiddenError` in `ActiveVisitPage.tsx`).
- ✅ Audit timeline and transcript stay fully visible for everyone.
- ✅ Tests (`ownership.test.tsx`): owner view has no banner, shows vitals edit + workflow buttons; non-owner view renders the banner naming the owner, hides Start Recording + vitals edit + all SOAP workflow buttons, and still shows SOAP content read-only.

**Past Visits redesign (practice-wide archive) — COMPLETE** (`claude/dashboard-visibility-feat.md` §2):
- ✅ `PastVisitsPage` rewritten: fetches `/sessions?scope=all` and always displays visits from every physician. All filtering is server-driven — no more client-side filtering.
- ✅ Debounced (300ms) search input sends `?search=` to the backend; matches patient fullName or MRN.
- ✅ Filter bar: new `PhysicianFilter` component (fetches `/api/physicians` on mount) sends `?physician=<id>`, and a status `<select>` covering every `SessionStatus` sends `?status=`. All filters combine in a single request with search.
- ✅ `VisitCard` already renders the physician name, so each card shows patient + date + `Dr. <Physician>` + status badge.
- ✅ Empty state is "No visits found" (same copy whether the list is empty because of filters or because nothing has been recorded).
- ✅ Tests (`pastVisits.test.tsx`, 8): scope=all fetch, multi-physician render, debounced search, physician filter, status filter, empty state, PhysicianFilter fetch + onChange. `routing.test.tsx` updated to the new empty-state copy.

**Dashboard redesign (active work queue) — COMPLETE** (`claude/dashboard-visibility-feat.md` §1):
- ✅ `DashboardPage` rewritten: fetches `/sessions?scope=mine`, filters out `COMPLETED`, renders three stat cards (In Progress = RECORDING+TRANSCRIBING+GENERATING_NOTE, Awaiting Review = IN_REVIEW, Completed This Week = COMPLETED in last 7 days), a prominent Start New Visit CTA, and a list of active sessions.
- ✅ New `ActiveSessionCard` component shows patient name, date, status badge, and an action-needed description per status (recording/transcribing/generating/in-review).
- ✅ Empty state when no active sessions with inline link to past visits; "View all past visits →" link at the bottom.
- ✅ Tests (`dashboard.test.tsx`, 10): scope=mine fetch, stat counts, non-completed filter, per-status action copy, empty state, greeting, CTA.

**Cross-physician visibility (backend) — COMPLETE** (`claude/dashboard-visibility-feat.md`):
- ✅ `GET /api/sessions` accepts `?scope=mine` (default) / `?scope=all`, plus `?physician=<id>` and `?search=` (case-insensitive patient fullName / mrn). Existing `?status=` filter still works with both scopes. When `scope=all`, response includes `physician: { id, fullName }`.
- ✅ `GET /api/sessions/:id` is practice-wide read — any authenticated physician can view any session. Response includes `physician: { id, fullName, credentials }`.
- ✅ `GET /api/sessions/:id/audit-events` is also practice-wide read.
- ✅ Ownership enforcement for writes via `lib/requireSessionOwner.ts` helper. Applied to: upload-audio, transcribe, generate-soap, PUT soap-note, submit-review, approve, POST vitals, PUT vitals. Non-owner returns `403 { error: "You can only modify sessions you created" }`.
- ✅ New `GET /api/physicians` endpoint returns `[{ id, fullName }]` for filter dropdowns.

**Enhanced Patient Management feature — COMPLETE** (`claude/patient-page-feat-spec.md`):
- ✅ Database: `Patient` expanded (sex, heightCm, eyeColor, bloodType); new `Allergy`, `Medication`, `Vitals` models; cascade delete on patient relations; Vitals one-to-one with Session.
- ✅ Seed: 6 demo patients with full profiles + realistic allergies + medications. No fake visits/transcripts/SOAP notes — those only come from real usage since they need authentic audio.
- ✅ API: allergy/medication CRUD nested under patients; vitals POST/PUT with 409 on duplicate + `VITALS_RECORDED` audit event; patient create/update accept new fields; list returns `_count`; detail returns nested allergies/medications/sessions; session detail now includes vitals.
- ✅ Frontend patient list page: `/patients` route, sidebar nav entry, `PatientCard`, debounced search, inline create form, skeleton loading, empty states.
- ✅ Frontend patient detail page: `/patients/:id` two-column layout (scrollable visit history left, sticky profile right). `PatientProfile` (inline edit), `AllergyList` (severity-colored chips + add/delete), `MedicationList` (add/edit/delete), `PatientVisitHistory` (Start New Visit + session rows). Skeleton loading, error toasts on all CRUD.
- ✅ Vitals UI on Active Visit Page: `VitalsForm` + `VitalsDisplay` in a Vitals section between the patient header and the audio recorder. Abnormal-value highlighting (yellow=borderline, red=critical for HR/temp/SpO2/BP systolic). Edit toggles back to the form and PUTs.
- ✅ Cross-linking: `VisitCard` shows physician name on Dashboard + Past Visits; `NewVisitPage` search consumes the expanded patient endpoint.
- ✅ Polish: "No known allergies" / "No current medications" empty states; skeleton placeholders; clean demo seed with no pre-generated sessions.

## Commands
- `npm run dev` — starts both frontend and backend
- `cd packages/server && npx prisma studio` — browse database
- `cd packages/server && npx prisma migrate dev` — run migrations

## Key Decisions
- Post-recording transcription (not live streaming) — upload audio after recording stops
- AssemblyAI for transcription + diarization (single API call)
- DeepSeek for SOAP note generation via OpenAI-compatible SDK (swap provider by changing LLM_BASE_URL + LLM_MODEL env vars)
- Audio stored on local filesystem (not S3) for demo simplicity
- Clerk handles all auth — physician record synced on first login

## Architecture Notes
- Session is the central entity: links physician, patient, transcript, SOAP note, and audit events
- AI pipeline is sequential: upload → transcribe (AssemblyAI) → generate SOAP (DeepSeek/LLM)
- Backend chains transcription and SOAP generation automatically after audio upload
- Audit events are created for every significant action

# Work Logging Rules
- After completing any significant task, feature, or bug fix, update the `claude/WORKLOG.md` file.
- Add a new entry at the top with the current date, a description of what was done, and key files modified.
- Keep the log concise.
- The format is 
[Date]
[Entry #]
[Structured description of work completed]