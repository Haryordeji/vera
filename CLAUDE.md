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

**In progress — Enhanced Patient Management feature** (`claude/patient-page-feat-spec.md`):
- ✅ Database: `Patient` expanded (sex, heightCm, eyeColor, bloodType); new `Allergy`, `Medication`, `Vitals` models; cascade delete on patient relations; Vitals one-to-one with Session.
- ✅ Seed data updated with profile fields, allergies, medications, and demo-session vitals.
- ✅ API: allergy/medication CRUD nested under patients; vitals POST/PUT with 409 on duplicate + `VITALS_RECORDED` audit event; patient create/update accept new fields; list returns `_count`; detail returns nested allergies/medications/sessions; session detail now includes vitals.
- ✅ Frontend patient list page: `/patients` route, sidebar nav entry, `PatientCard`, debounced search, inline create form with all profile fields, `usePatient` hook wrapping the API surface.
- ✅ Frontend patient detail page: `/patients/:id` two-column layout (scrollable visit history left, sticky profile right). `PatientProfile` (inline edit), `AllergyList` (severity-colored chips + add/delete), `MedicationList` (add/edit/delete), `PatientVisitHistory` (Start New Visit button + chronological session rows with physician/status/SOAP pill).
- ⏳ Vitals UI on Active Visit Page — not yet implemented.

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