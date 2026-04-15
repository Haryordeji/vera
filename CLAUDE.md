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

**Review Assignment Dashboard & Audit Timeline — COMPLETE** (`claude/assign-review-spec.md` — Dashboard Updates + Audit Trail Events):
- ✅ `Session` type gains optional `reviewAssignment?: boolean` marker (set by `GET /sessions?scope=mine` backend union).
- ✅ New `components/visit/ReviewAssignmentCard.tsx` — shows patient name, visit date, owning physician ("Dr. X's session · SOAP note waiting for your sign-off"), blue `UserCheck` avatar, and the `IN_REVIEW` status badge. Testids: `review-assignment-card`, `review-assignment-card-meta`. Click navigates to `/visits/:id` where the reviewer actions render.
- ✅ `DashboardPage` splits the `scope=mine` response into `ownedSessions` (marker absent/false) and `reviewAssignments` (marker true). Stats reshuffled: **In Progress** now counts only owned in-flight sessions; **Awaiting Review** is replaced by **Awaiting Your Sign-off** (`stat-awaiting-signoff`, `UserCheck` icon, count = `reviewAssignments.length`); **Completed This Week** still counts owned completed sessions within 7 days. A new "Assigned to You for Review" section renders below "Your Active Sessions" only when there are entries — no empty state (`assigned-for-review-section`, `assigned-for-review-list`).
- ✅ `AuditTimeline` extended for the new workflow events:
  - `REVIEW_ASSIGNED` — sky `Send` icon, "Assigned" badge (sky-100 text-sky-700). Backend already sets `description` to "Review assigned to Dr. X by Dr. Y" and `metadata: { assignedTo }`.
  - `REVIEW_RETURNED` — amber `CornerUpLeft` icon, "Returned" badge (amber-100 text-amber-700). Renders the feedback text inline as a styled `<blockquote>` below the event row when `metadata.feedback` is a non-empty string (`audit-event-feedback-${i}` testid). Metadata toggle still available for the raw payload.
  - `NOTE_APPROVED` — unchanged visual (emerald `CheckCircle2`, "Signed" badge). Backend description already names the approver.
  - Legacy `REVIEW_REQUESTED` events from pre-assign-review audit trails are aliased onto the same visual treatment as `REVIEW_ASSIGNED` (falls through the same switch case) so historical rows render gracefully without a migration.
- ✅ Cleanup: dropped the unused `Eye` and `ClipboardCheck` imports from the timeline/dashboard; no frontend references to the removed `submit-review` endpoint or `REVIEW_REQUESTED` event type (other than the legacy fallback) remain.
- ✅ Tests:
  - `dashboard.test.tsx` updated: new `makeReviewAssignment(id, patient, owner, date)` fixture helper; stat test now seeds 2 review assignments and asserts the `stat-awaiting-signoff-value`; new "shows 'Assigned to You for Review' section when review assignments exist" test (card renders with patient + "Dr. James Lee" + "SOAP note waiting for your sign-off"); new "hides…when none" test (section absent, `stat-awaiting-signoff-value === 0`); new "does not count review assignments in 'In Progress'" test (ensures split is correct). Existing sidebar-badge tests still pass (review assignments with `IN_REVIEW` count as non-completed).
  - `auditTimeline.test.tsx`: renamed the `REVIEW_REQUESTED` sample event to `REVIEW_ASSIGNED`; icon/badge assertions updated. New cases: legacy `REVIEW_REQUESTED` still renders with "Assigned" badge; `REVIEW_RETURNED` renders with "Returned" badge and an inline `audit-event-feedback-0` blockquote containing the feedback text; `NOTE_APPROVED` shows the approver from `description`.

**Review Feedback Loop & Reviewer Experience — COMPLETE** (`claude/assign-review-spec.md` — Reviewer experience + feedback banner):
- ✅ New `components/soap/ReviewFeedbackBanner.tsx` — amber callout with `MessageSquareWarning` icon, heading "Dr. {reviewerName} returned this note for revision:" (falls back to "The assigned reviewer returned this note for revision:" when the name is missing), and the feedback text in an italicized `<blockquote>` with a left border. Testids: `review-feedback-banner`, `review-feedback-banner-heading`, `review-feedback-banner-body`. Not dismissable — the backend clears `reviewFeedback` on the next `assign-review` call.
- ✅ `OwnershipBanner` is now context-aware via a new `asAssignedReviewer?: boolean` prop. Default (unchanged): `Eye` icon + "You are viewing in read-only mode." (`data-variant="read-only"`). Reviewer variant: `UserCheck` icon + "You are reviewing this note." (`data-variant="reviewer"`). Both variants share the same "This visit was conducted by Dr. X." lede.
- ✅ `ActiveVisitPage` banner wiring:
  - `showOwnershipBanner = knownNonOwner` — the banner now renders for the assigned reviewer too (previously gated out). Copy adapts via `asAssignedReviewer={isAssignedReviewer}`.
  - Inline feedback banner JSX replaced with `<ReviewFeedbackBanner reviewerName={assignedReviewerName} feedback={reviewFeedback} />`. Condition relaxed from `isOwner && reviewFeedback` to just `reviewFeedback` — the banner is DRAFT-only (via the existing `reviewFeedback` derivation that returns `null` outside DRAFT), so reviewers who navigate back to a note they returned also see their own feedback. Positioned immediately above the SOAP panel.
  - `MessageSquareWarning` import removed from the page (now lives inside `ReviewFeedbackBanner`).
- ✅ Reviewer experience on the Active Visit page (end-to-end):
  - `OwnershipBanner` renders with `reviewer` variant naming the owning physician.
  - Transcript, vitals (`VitalsDisplay` without edit), and audio recorder (read-only placeholder) — all inherited from the existing non-owner path.
  - `SoapNoteEditor` stays `readOnly={isApproved || !isOwner}` so the reviewer reads but doesn't edit SOAP content.
  - `SoapWorkflowActions` reviewer branch renders `Approve & Sign` + `Return to Draft` (already implemented in the prior frontend entry).
  - Audit timeline unchanged — reviewer sees every event including `REVIEW_ASSIGNED`.
- ✅ Tests (`reviewerExperience.test.tsx`, 8 new):
  - `ReviewFeedbackBanner` renders name + feedback; falls back to generic heading when `reviewerName` is null.
  - `ActiveVisitPage` renders the banner when a DRAFT note carries `reviewFeedback`; doesn't render when `reviewFeedback` is null; doesn't render on `PENDING_REVIEW` or `APPROVED` even with leftover feedback (`it.each`).
  - Assigned reviewer sees the ownership banner with `data-variant="reviewer"` and "reviewing this note" text (no "read-only" language).
  - Reviewer sees SOAP content as read-only (textarea has `readonly` attribute), no owner workflow buttons (`btn-save-draft`, `btn-sign-finalize`, `btn-assign-review`), but does see `btn-reviewer-approve` + `btn-return-to-draft`.
  - Uninvolved physician still gets the classic `data-variant="read-only"` banner variant.

**Review Assignment Workflow (frontend) — COMPLETE** (`claude/assign-review-spec.md` — Frontend Changes):
- ✅ `SoapNote` type extended: `assignedReviewerId?`, `assignedReviewer?: { id, fullName }`, `reviewFeedback?`.
- ✅ New `components/soap/AssignReviewDialog.tsx` — modal that fetches `/physicians` on open, filters out the current user, renders a `<select>` of colleagues, POSTs to `/sessions/:id/soap-note/assign-review` with `{ reviewerId }`, shows toast "Assigned to Dr. X for review", and calls `onAssigned(updatedNote, reviewerName)`. Testids: `assign-review-dialog`, `assign-review-loading`, `assign-review-empty`, `assign-review-select`, `assign-review-option-${id}`, `assign-review-cancel`, `assign-review-submit`. Forbidden errors surface the standard "You can only modify sessions you created." toast.
- ✅ `SoapWorkflowActions` rewritten around `isOwner` / `isAssignedReviewer` / `workflowStatus`:
  - Owner + DRAFT → `Save Draft` + `Sign & Finalize` (ConfirmDialog) + `Assign for Review` (opens dialog via `onAssignForReview`).
  - Owner + PENDING_REVIEW → `Save Draft` only + `pending-review-info` banner naming the assigned reviewer ("Assigned to Dr. X for review. You can still edit the note while you wait.").
  - Owner + APPROVED → nothing.
  - Reviewer + PENDING_REVIEW → `Approve & Sign` (ConfirmDialog) + `Return to Draft` toggle that reveals an inline panel (`return-to-draft-panel`) with a textarea placeholder "Optional: explain what needs to be revised…", Cancel, and Submit. Submit forwards the trimmed feedback through `onReturnToDraft`.
  - Reviewer outside PENDING_REVIEW, or uninvolved physician → nothing rendered.
- ✅ `ActiveVisitPage` wiring: new `assignReviewOpen` + `returningToDraft` state, `handleAssigned` (updates `session.soapNote`, refetches audit events), `handleReturnToDraft(feedback)` (POST to `/return-to-draft`, toast, update session, 403 handling). Derives `isAssignedReviewer` from `currentPhysician.id === session.soapNote.assignedReviewer.id`. `showOwnershipBanner = knownNonOwner && !isAssignedReviewer` so assigned reviewers don't see the "read-only" banner. Renders a new amber `review-feedback-banner` (MessageSquareWarning icon) above the SOAP panel when the owner is viewing a DRAFT note that carries `reviewFeedback`. `SoapNoteEditor` stays `readOnly={isApproved || !isOwner}` — reviewers approve/return, they don't edit SOAP content.
- ✅ Tests (`soapWorkflow.test.tsx` rewritten with hoisted `vi.mock` pattern for `@/lib/api` + `@clerk/clerk-react`, `renderWithToast` helper): owner DRAFT shows all three buttons + Sign & Finalize confirm + Assign for Review click; owner PENDING_REVIEW shows only Save Draft + info line with reviewer name; APPROVED renders nothing; reviewer PENDING_REVIEW shows Approve & Sign + Return to Draft, Approve confirm calls `onApprove`, Return panel forwards typed feedback (and empty-string case); reviewer outside PENDING_REVIEW renders nothing; uninvolved physician (`it.each` over DRAFT/PENDING_REVIEW/APPROVED) renders nothing; `AssignReviewDialog` excludes current user from the select, POST flow calls `onAssigned`, closed state doesn't fetch. Existing `SoapNoteEditor readOnly` and `ConfirmDialog` tests retained.

**Review Assignment Workflow (backend) — COMPLETE** (`claude/assign-review-spec.md`):
- ✅ Schema: `SoapNote.assignedReviewerId String?` + `SoapNote.reviewFeedback String?` + `SoapNote.assignedReviewer Physician?` relation; `Physician.assignedReviews SoapNote[]` reverse relation. Migration `20260415125054_add_review_assignment` applied.
- ✅ `POST /api/sessions/:id/soap-note/assign-review` — replaces the old `submit-review` endpoint. Body `{ reviewerId }`. Owner-only (via `requireSessionOwner`), requires current status `DRAFT`, rejects self-assignment (400), rejects unknown `reviewerId` (400). In a transaction: sets `workflowStatus = PENDING_REVIEW`, sets `assignedReviewerId`, clears `reviewFeedback`, writes `REVIEW_ASSIGNED` audit event with `metadata: { assignedTo: reviewer.fullName }`.
- ✅ `POST /api/sessions/:id/soap-note/approve` — now supports two paths. Path 1: owner self-approval from `DRAFT` (same as before, stamps owner as `approvedBy`). Path 2: reviewer approval from `PENDING_REVIEW` — caller must be the `assignedReviewerId`. Either path flips `Session.status` → `COMPLETED` and writes `NOTE_APPROVED` audit with `metadata: { approvedBy: caller.fullName }`. 403 if caller is neither owner nor assigned reviewer; 400 if the status doesn't match the caller's role (e.g. owner trying to approve a PENDING_REVIEW note). Uses inline ownership check (not `requireSessionOwner`) so the reviewer — who is not the session owner — can legitimately approve.
- ✅ `POST /api/sessions/:id/soap-note/return-to-draft` — new endpoint. Body `{ feedback?: string }`. Caller must be the `assignedReviewerId` (403 otherwise), current status must be `PENDING_REVIEW` (400 otherwise). Transaction: sets `workflowStatus = DRAFT`, stores trimmed feedback or `null`, keeps `assignedReviewerId` intact so the owner sees who returned it. Writes `REVIEW_RETURNED` audit event with `metadata: { returnedBy: reviewer.fullName, feedback }`.
- ✅ `GET /api/sessions/:id` — `soapNote` response now includes `assignedReviewer: { id, fullName }` and `reviewFeedback`.
- ✅ `GET /api/sessions?scope=mine` — now returns a union: owned sessions (marked `reviewAssignment: false`) plus sessions authored by other physicians where the caller is the `assignedReviewerId` on a `PENDING_REVIEW` SOAP note (marked `reviewAssignment: true`). Dedupe on id. Archive filter still applies to both sides. `scope=all` is unchanged.
- ✅ Frontend-reference cleanup: `ActiveVisitPage.handleRequestReview` no longer calls the removed `submit-review` endpoint — placeholder toast. The `SoapWorkflowActions` UI, `AssignReviewDialog`, `ReviewFeedbackBanner`, `ReviewerActions`, and dashboard "Assigned to You for Review" section from the spec are deferred as a frontend follow-up.
- ✅ Tests (`soapWorkflow.test.ts` rewritten; `crossPhysicianVisibility.test.ts` updated):
  - `assign-review`: DRAFT→PENDING_REVIEW + metadata, 400 on wrong status, 403 on non-owner, 400 on self-assign, 400 on missing/unknown reviewerId, 401, 404.
  - `approve`: Path 1 owner-from-DRAFT (stamps owner); Path 2 reviewer-from-PENDING_REVIEW (stamps reviewer + metadata); 403 non-owner/non-reviewer on DRAFT; 400 owner-on-PENDING_REVIEW; 400 already APPROVED; 401; 404.
  - `return-to-draft`: happy path with feedback (stores feedback + keeps reviewer id + audit metadata); empty body → `null` feedback; 403 non-reviewer; 400 from DRAFT; 401; 404.
  - `scope=mine`: includes sessions where caller is assigned reviewer with `reviewAssignment: true`; owned sessions marked `reviewAssignment: false`.

**UX Fixes (Issue 5) — "Settings" → "My Profile" rename — COMPLETE** (`claude/ux-fixes-1-spec.md` §5):
- ✅ `Sidebar` — nav item relabeled "Settings" → "My Profile"; icon swapped from `Settings` (gear) to `UserCircle` (profile). Route target updated to `/profile`.
- ✅ Route — `/settings` now renders `<Navigate to="/profile" replace />` so any bookmarked/legacy `/settings` URL 302s to the new path. `/profile` renders the real page.
- ✅ `SettingsPage.tsx` → `ProfilePage.tsx` (git mv). Component renamed to `ProfilePage`; `AppLayout title` + `<h2>` both say "My Profile".
- ✅ Tests (`routing.test.tsx`): `ProfilePage shows heading and profile section` (asserts `^my profile$` heading), `renders all nav links` now asserts "My Profile" is present and "Settings" is not, `My Profile link has correct href` → `/profile`, and new `/settings redirects to /profile` test renders the redirect route directly and asserts the ProfilePage heading appears.

**UX Fixes (Issues 3 + 4) — List error/empty states + edit-mode gating — COMPLETE** (`claude/ux-fixes-1-spec.md` §§3–4):
- ✅ New shared `components/ui/ListError.tsx` — centered error pane with `Try again` retry button. Props: `message?`, `onRetry`, `testId?`; retry test-id auto-generated as `${testId}-retry`.
- ✅ `DashboardPage` — fetch extracted to stable `loadSessions` useCallback; `error` state; render order loading → `ListError` (`dashboard-error`) → empty → active list. No toasts on empty responses.
- ✅ `PastVisitsPage` — new `error` + `reloadNonce` state (retry increments nonce; fetch effect depends on multiple reactive values). Empty copy now conditional: filters active → "No visits match your filters." + subtext; no filters → "No visits found." Error testid `past-visits-error`.
- ✅ `PatientListPage` — `error` state replaces the prior toast. Empty subtext tightened to "Add your first patient." Error testid `patient-list-error`, empty testid `patient-list-empty`.
- ✅ `PatientDetailPage` — same `reloadNonce` retry pattern. Error testid `patient-detail-error`. Lifts `editing` state to the page so it drives the profile/allergies/medications gate.
- ✅ `PatientVisitHistory` — empty copy rewritten to "No visits yet for this patient. / Start the first one." (`patient-visit-history-empty`).
- ✅ `PatientProfile` — now supports controlled editing (`editing?`, `onStartEdit?`, `onFinishEdit?`) while preserving backward compatibility (falls back to internal `uncontrolledEditing` state when parent doesn't pass `editing`). A `useEffect` rehydrates the form snapshot each time `editing` flips true.
- ✅ `AllergyList` + `MedicationList` — new `editable?: boolean` prop (default `true` to keep standalone tests working). When `false`: chip remove-X / row edit+delete cluster and the Add form/button are all hidden (content itself still renders). `PatientDetailPage` passes `editable={editing}` so one Edit click unlocks demographics + allergies + medications together.
- ✅ Tests (`errorStates.test.tsx`, 8): empty patient list shows `patient-list-empty` not error; zero-session patient detail shows `patient-visit-history-empty` not error; rejected patient list fetch shows `patient-list-error` + retry; rejected patient detail fetch shows `patient-detail-error` + retry; AllergyList `editable={false}` hides remove+add; `editable={true}` shows them; MedicationList `editable={false}` hides edit/delete/add; `editable={true}` shows them. Existing `pastVisits.test.tsx` + `routing.test.tsx` empty-state assertions updated to "No visits found."

**UX Fixes (Issue 2) — Archive pattern (frontend) — COMPLETE** (`claude/ux-fixes-1-spec.md` §2):
- ✅ `Patient` / `Session` / `PatientSummary` types extended with optional `archivedAt`. `usePatient` hook now accepts `fetchPatients(search, { includeArchived })` and exposes `archivePatient` / `unarchivePatient`.
- ✅ `PatientCard` + `VisitCard` converted from outer `<button>` to `<div role="button">` so the new Unarchive button (`*-card-unarchive`) can live inside. Archived rows render muted (`bg-slate-50 opacity-75`) with an "Archived" pill badge (`*-card-archived-badge`). `VisitCard` requires `canUnarchive` (owner) + `unarchiveSession` before showing the button; non-owners see archived rows but no restore affordance.
- ✅ `PatientDetailPage` — header action renders `patient-archive-btn` (active) or `patient-unarchive-btn` + `patient-archived-banner` (archived). Archive opens `ConfirmDialog` → `POST /patients/:id/archive` → toast + navigate to `/patients`. Unarchive is inline (no confirm) and updates local state.
- ✅ `ActiveVisitPage` — owner-only `visit-archive-btn` in the `PageHeader` children slot (styled as a subtle slate link, not a prominent button). ConfirmDialog → `POST /sessions/:id/archive` → toast "Visit archived" + navigate to `/visits`. For archived visits owned by the current physician, header shows `visit-unarchive-btn` and a `visit-archived-banner` pill renders under the date. 403 responses surface "You can only modify sessions you created." via the existing `isForbiddenError` helper.
- ✅ `PatientListPage` — new `patient-show-archived-toggle`; `loadPatients` threads `includeArchived` through the debounced search effect. Unarchive removes (toggle off) or updates in place (toggle on).
- ✅ `PastVisitsPage` — new `visit-include-archived-toggle` composed with scope=all + search + physician + status. Uses `useCurrentPhysician` to compute per-row `canUnarchive`, so archived visits from other physicians render without an unarchive button.
- ✅ Tests (`archive.test.tsx`, 10): patient list toggle refetches with `?includeArchived=true`; archived patients render badge + unarchive button; detail page dialog flow archives + navigates; detail page shows unarchive + banner when archived; past visits toggle refetches with archived param; unarchive button gating respects ownership across mixed-owner list; ActiveVisitPage owner sees archive button, non-owner doesn't, confirm flow posts + navigates.

**UX Fixes (Issue 2) — Archive pattern (backend) — COMPLETE** (`claude/ux-fixes-1-spec.md` §2):
- ✅ Schema: `Patient.archivedAt DateTime?` + `Session.archivedAt DateTime?`. Migration `20260415042817_add_archive_fields` applied.
- ✅ `GET /api/patients` defaults to `where: { archivedAt: null }`; `?includeArchived=true` skips the filter. Composes with `?search=`.
- ✅ `GET /api/sessions` (both `scope=mine` and `scope=all`) defaults to `where: { archivedAt: null }`; `?includeArchived=true` skips the filter. Composes with `status`, `physician`, `search`.
- ✅ `GET /api/patients/:id` — the patient record itself is still returned even when archived (you need to view it to unarchive it). The nested `sessions` list defaults to excluding archived rows; pass `?includeArchived=true` to include them.
- ✅ `POST /api/patients/:id/archive` / `/unarchive` — set or clear `archivedAt`; 404 on unknown id. No ownership check (patients are practice-wide records, not owned by a physician).
- ✅ `POST /api/sessions/:id/archive` / `/unarchive` — owner-only via `requireSessionOwner` (403 for non-owner, 404 for unknown). Wraps the update + audit event in a `prisma.$transaction`. Emits `SESSION_ARCHIVED` ("Visit archived by Dr. …") or `SESSION_UNARCHIVED` ("Visit restored by Dr. …") audit events. Returns the updated session with `patient` and `physician` included.
- ✅ Tests (`archive.test.ts`, 15): patient list excludes/includes archived by default/`includeArchived`; archive+unarchive patient flow hides/restores from list; archive returns 404 for unknown; archived patient still fetchable via detail; session list (scope=mine and scope=all) excludes/includes archived; session archive/unarchive returns 403 for non-owner; returns 404 for unknown; owner archive+unarchive flow sets/clears `archivedAt`, creates the correct audit event, hides/restores from default list; patient detail nested sessions respect archive filter.

**UX Fixes (Issue 1) — PageHeader back navigation — COMPLETE** (`claude/ux-fixes-1-spec.md` §1):
- ✅ New `components/layout/PageHeader.tsx`: props `title`, optional `backTo` (path or `"history"`), optional `backLabel`, optional `children` (right-side action slot). Renders a left-arrow back button above the title when `backTo` is set; `"history"` calls `navigate(-1)`, otherwise `navigate(backTo)`. `data-testid="page-header"` + `"page-header-back"`.
- ✅ `PatientDetailPage` — `backTo="/patients"`, label "Back to Patients". Replaces the old inline `Link` + `ArrowLeft` block.
- ✅ `ActiveVisitPage` — `backTo="history"`, label "Back" (uses browser history since you can arrive from Dashboard, Past Visits, or Patient Detail). `StatusBadge` is slotted into the header's right-side `children`. Recorded-at timestamp kept under the header.
- ✅ `NewVisitPage` — `backTo="/"`, label "Back to Dashboard".
- ✅ Top-level nav pages (`/`, `/patients`, `/visits`, `/settings`) intentionally do **not** use `PageHeader` — no back button, since they're reachable directly from the sidebar.
- ✅ Tests (`pageHeader.test.tsx`, 6): title renders, back button appears when `backTo` set, back button hidden when `backTo` omitted, `navigate("/patients")` on path click, `navigate(-1)` on `"history"` click, children render in the action slot.

**Dashboard & Cross-Physician Visibility feature — FINALIZED** (`claude/dashboard-visibility-feat.md`):
- ✅ `Sidebar` now fetches `/sessions?scope=mine` on mount and displays a small active-session badge on the Dashboard nav item when there are any non-`COMPLETED` sessions. Badge is omitted silently when count is 0 or the fetch fails.
- ✅ Dashboard empty state rewritten: "All caught up! No sessions need your attention." with an inline Start New Visit button (`data-testid="dashboard-empty-cta"`). Replaces the older "No active sessions" copy.
- ✅ Past Visits empty state rewritten: "No visits match your search." (heading) + "Try adjusting your search or filters." (subtext). The practice-wide archive is rarely truly empty, so the single copy covers both no-results-for-filter and no-data-at-all.
- ✅ Patient Detail visit history was already cross-physician (backend query is by `patientId` only, includes `physician.fullName`, and each row navigates to `/visits/:id` which renders `ActiveVisitPage` with read-only mode for non-owners). Verified end-to-end; no code changes needed.
- ✅ Navigation flow audited: Dashboard "View all past visits →" → `/visits`; `VisitCard` click → `/visits/:id`; `PatientVisitHistory` row click → `/visits/:id`. All non-owner destinations render the ownership banner + read-only UI.
- ✅ Tests: `dashboard.test.tsx` updated for new empty copy + 2 new sidebar-badge cases (count reflects non-completed sessions, badge absent when none). `pastVisits.test.tsx` and `routing.test.tsx` assertions updated to the new empty-state copy. `dashboard.test.tsx` mocks switched from `mockResolvedValueOnce` → `mockResolvedValue` so both DashboardPage and Sidebar see the same fixture.

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
- ✅ Empty state is "No visits match your search." (same copy whether the list is empty because of filters or because nothing has been recorded — the page is always practice-wide).
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