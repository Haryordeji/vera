# Vera — Work Log

---

## 2026-04-15
### Entry #24 — UX Fixes (Issue 2): Archive Pattern (Backend)

Second slice of `claude/ux-fixes-1-spec.md`. Implements the soft-delete/archive pattern for patients and sessions. Backend only — schema, endpoints, tests. Frontend controls (confirmation dialogs, archived-view toggles) are a separate slice.

**Schema + migration:**
- `Patient.archivedAt DateTime?` and `Session.archivedAt DateTime?` — nullable, `null` means active.
- `npx prisma migrate dev --name add-archive-fields` → new migration `20260415042817_add_archive_fields`. Prisma client regenerated (`src/generated/prisma`).

**List-endpoint archive filtering:**
- `GET /api/patients` — defaults to `where: { archivedAt: null }`. `?includeArchived=true` drops the filter. The search filter (`?search=…`) now composes with the archive filter via a shared `where` object rather than the old ternary.
- `GET /api/sessions` — same treatment, on both `scope=mine` and `scope=all`. `?includeArchived=true` works in combination with every other query param (`status`, `physician`, `search`).
- `GET /api/patients/:id` — patient record itself is still returned regardless of archive state (needed so the unarchive UI has something to render). The nested `sessions` include now carries a `where: { archivedAt: null }` by default. `?includeArchived=true` on this endpoint flips to no filter on the nested sessions.
- `sessions` selection on the patient detail endpoint also now includes `archivedAt: true` so the frontend can show a muted row for archived visits once the UI slice lands.

**Archive/unarchive endpoints:**
- `POST /api/patients/:id/archive` / `/unarchive` — 404 if the patient doesn't exist; otherwise updates `archivedAt` (to `new Date()` or `null`) and returns the updated row. No ownership check: patients aren't owned by a physician in this model and any clinician in the practice might reasonably archive one. Matches the spec's "Archive Patient" dropdown option on the patient detail page.
- `POST /api/sessions/:id/archive` / `/unarchive` — standard auth + `getPhysician` + `requireSessionOwner` preamble (auth, 400 if no physician profile, 404 for unknown session, 403 for non-owner — spec explicitly requires owner-only). The update + audit event are wrapped in `prisma.$transaction` to mirror the rest of the session write endpoints. Audit event types:
  - `SESSION_ARCHIVED`, description `"Visit archived by Dr. <name>"`
  - `SESSION_UNARCHIVED`, description `"Visit restored by Dr. <name>"`
- Returns the updated session with `patient` + `physician` included, same shape as the other session-mutation responses.

**Tests — `archive.test.ts` (15 cases):**
- Seeds two physicians (`OWNER`, `OTHER`), two patients (one active, one seeded archived), and four sessions: an active owner session, a pre-archived owner session, an owner session used to exercise the archive/unarchive round trip, and a non-owner session used as a 403 probe. Each test file uses `Date.now()`-suffixed clerk ids / MRNs to avoid collisions with other server test files that share the same database.
- Clerk auth is mocked the same way as the other server tests: a `requireAuth` that reads `x-test-clerk-user-id`, and a `getAuth` that returns `req.__clerkAuth`.
- Cases:
  - `GET /api/patients` excludes archived by default; returns them with `?includeArchived=true`; search composes with both.
  - `POST /api/patients/:id/archive` sets `archivedAt` and hides from the default list; `/unarchive` clears it and restores. Unknown id returns 404. `GET /api/patients/:id` still returns an archived patient.
  - `GET /api/sessions` excludes archived by default on both `scope=mine` and `scope=all`; `?includeArchived=true` brings them back on both scopes.
  - `POST /api/sessions/:id/archive` and `/unarchive` both return 403 when a non-owner calls them; 404 for unknown ids.
  - Owner archive flow: sets `archivedAt`, creates exactly one `SESSION_ARCHIVED` audit event authored by the owner's `fullName`, and the session disappears from the default list.
  - Owner unarchive flow: clears `archivedAt`, creates exactly one `SESSION_UNARCHIVED` audit event authored by the owner's `fullName`, and the session reappears in the default list.
  - Patient detail nested sessions: default excludes the pre-archived session; `?includeArchived=true` includes it.
- `afterAll` cleans up in dependency order (audit events → sessions → patients → physicians).

**Files touched:**
- `packages/server/prisma/schema.prisma` (+ `archivedAt` on Patient and Session)
- `packages/server/prisma/migrations/20260415042817_add_archive_fields/` (new)
- `packages/server/src/routes/patients.ts` (list filter, detail filter, archive + unarchive)
- `packages/server/src/routes/sessions.ts` (list filter, archive + unarchive)
- `packages/server/src/__tests__/archive.test.ts` (new, 15 cases)
- `CLAUDE.md`

Server typecheck passes (`npx tsc --noEmit` clean). Test suite run skipped per standing instruction — I did not run `npx vitest run`; the user will run these manually.

---

## 2026-04-15
### Entry #23 — UX Fixes (Issue 1): PageHeader Back Navigation

First slice of `claude/ux-fixes-1-spec.md`. Adds a contextual back button to every detail page via a shared `PageHeader` component, so drilling into a visit or patient no longer leaves you reaching for the browser back button.

**New component — `components/layout/PageHeader.tsx`:**
- Props: `title: string`, `backTo?: string` (path or the literal `"history"`), `backLabel?: string`, `children?: ReactNode` (right-side action slot).
- When `backTo` is set, renders a compact left-arrow button above the title. `"history"` → `navigate(-1)`, anything else → `navigate(backTo)`. When `backTo` is omitted the button is not rendered at all (so the same component works in contexts where only the title is needed).
- Title is an `h2` at `text-2xl font-semibold`, with children (e.g. a status badge) pinned to the right. `data-testid`s: `page-header`, `page-header-back`.
- Lives in `layout/` alongside `AppLayout` / `Sidebar` since it's a chrome element, not a domain component.

**Page wiring:**
- `PatientDetailPage` — replaced the inline `Link` + `ArrowLeft` + "Back to patients" block with `<PageHeader title={patient?.fullName ?? "Patient Detail"} backTo="/patients" backLabel="Back to Patients" />`. Dropped the now-unused `Link` / `ArrowLeft` imports.
- `ActiveVisitPage` — replaced the inline visit-header div with `<PageHeader title={patient?.fullName ?? "Unknown Patient"} backTo="history" backLabel="Back">{status && <StatusBadge />}</PageHeader>` and kept the recorded-at timestamp as a small line directly below. Uses browser history (`navigate(-1)`) because this page is reachable from Dashboard, Past Visits, and Patient Detail — returning to wherever the user came from is more useful than any single fixed target.
- `NewVisitPage` — swapped the hand-rolled `h2 "New Visit"` for `<PageHeader title="New Visit" backTo="/" backLabel="Back to Dashboard" />`. Subtitle copy ("Select an existing patient…") stays, nudged up with a `-mt-3` so it still tucks under the title.
- Not touched: `DashboardPage`, `PatientListPage`, `PastVisitsPage`, `SettingsPage`. These are top-level sidebar destinations — a back button on them would land nowhere meaningful.

**Tests — `pageHeader.test.tsx` (6):**
- Follows the `patientDetail.test.tsx` mocking pattern: hoisted `mockNavigate` + partial `react-router-dom` mock overriding only `useNavigate`. The component is rendered inside `MemoryRouter`.
- Cases:
  1. Title renders.
  2. Back button with the given label renders when `backTo` is set.
  3. Back button is absent when `backTo` is omitted.
  4. Clicking the back button with a path calls `navigate("/patients")`.
  5. Clicking the back button with `backTo="history"` calls `navigate(-1)`.
  6. `children` render in the right-side action slot.

**Notes:**
- Verified no existing test asserts the old "Back to patients" link copy, so no test updates needed elsewhere.
- `routing.test.tsx:81` still matches (`heading level 2, name /new visit/i`) — PageHeader's h2 preserves it.

**Files touched:**
- `packages/web/src/components/layout/PageHeader.tsx` (new)
- `packages/web/src/pages/PatientDetailPage.tsx` (use PageHeader, drop inline back link)
- `packages/web/src/pages/ActiveVisitPage.tsx` (use PageHeader with StatusBadge slot)
- `packages/web/src/pages/NewVisitPage.tsx` (use PageHeader)
- `packages/web/src/__tests__/pageHeader.test.tsx` (new, 6 tests)
- `CLAUDE.md`

Web test suite run skipped per standing instruction — will be verified manually.

---

## 2026-04-15
### Entry #22 — Dashboard & Cross-Physician Visibility: Final Polish

Wraps up `claude/dashboard-visibility-feat.md`. The four core slices (Entries #18 backend, #19 dashboard, #20 past visits, #21 read-only) shipped last week. This entry is the finalization pass: empty-state copy, a sidebar count badge, and an end-to-end audit of the cross-physician flow.

**Patient Detail visit history — verified (no code changes):**
- Backend `GET /api/patients/:id` (`routes/patients.ts:80-110`) already queries sessions by `patientId` only, with no physician filter, and `include`s `physician: { select: { fullName: true } }`. So a brand-new physician opening a patient page sees every visit for that patient regardless of who conducted it.
- `PatientVisitHistory` already renders `Dr. {v.physician.fullName}` per row and navigates to `/visits/${v.id}`.
- `/visits/:id` → `ActiveVisitPage`, which (after Entry #21) derives `isOwner` from `/auth/me` vs `session.physicianId` and flips into full read-only mode with the ownership banner for non-owners. End-to-end cross-physician view path works without any additional wiring.

**Sidebar active-session badge:**
- `Sidebar` gained a `useEffect` that fetches `/sessions?scope=mine` on mount, counts non-`COMPLETED` sessions, and stores the count in local state. A small pill badge (`data-testid="sidebar-active-badge"`, blue background, white text) renders inside the Dashboard `NavLink` when `activeCount > 0`. Failure/loading cases silently render no badge — this is a peripheral signal, not a blocker.
- Array-ness is defensively guarded so tests that mock non-array responses don't crash the sidebar on mount.
- Trade-off: the sidebar now makes its own `/sessions?scope=mine` request in addition to the Dashboard's. This is a ~1KB duplicate request on Dashboard views but keeps the sidebar self-contained on every other page (Patients, Past Visits, Settings) where the Dashboard component isn't mounted. Not wiring it through a shared context for a single badge.

**Empty state copy rewrites:**
- `DashboardPage`: replaced "No active sessions. Start a new visit or view past visits." with the warmer "All caught up! No sessions need your attention." + a green check icon + a proper Start New Visit button (`dashboard-empty-cta`) instead of the inline text link. The "View all past visits →" link at the bottom of the page remains.
- `PastVisitsPage`: replaced the heading "No visits found" with "No visits match your search." The supporting subtext ("Try adjusting your search or filters.") is unchanged. This is a single copy for both "filters excluded everything" and "nothing in the database yet" — the page is always practice-wide, so the brand-new-practice case is just as much about filters as any other zero-result state.

**Test updates:**
- `dashboard.test.tsx`:
  - Swapped every `mockGet.mockResolvedValueOnce(...)` to `mockResolvedValue(...)` so both `DashboardPage` and the new `Sidebar` fetch resolve against the same fixture (children useEffects fire before parents, so the Sidebar would otherwise steal the one-shot mock).
  - Empty-state test now asserts the new copy and the `dashboard-empty-cta` button.
  - Two new tests: sidebar badge shows the correct count with mixed statuses (2 non-completed of 3); badge is absent when only completed sessions exist.
- `pastVisits.test.tsx`: empty-state assertion and test name updated to "No visits match your search."
- `routing.test.tsx`: empty-state assertion updated to the same copy.
- Existing `ownership.test.tsx` and `patientDetail.test.tsx` unaffected — their mocks handle the new `/sessions?scope=mine` fallthrough safely (null/non-array → defensive empty count).

**Navigation flow audit — confirmed:**
- Dashboard "View all past visits →" → `/visits` ✅
- `VisitCard` click → `/visits/:id` ✅ (Dashboard + Past Visits)
- `PatientVisitHistory` row click → `/visits/:id` ✅
- All three paths land on `ActiveVisitPage`, which renders read-only + banner when the viewer isn't the owner.

**Manual verification (two-physician scenario) — left to the user per `DO NOT RUN npx vitest run` standing instruction.** The intended flow: Physician A records + approves a session for a patient; Physician B signs in, sees A's visit on `/visits`, opens it and confirms the ownership banner + read-only SOAP/vitals/audio, opens the same patient from `/patients`, confirms the visit is listed under Dr. A in the history, clicks it, confirms the same read-only behavior, then starts their own visit on the same patient and confirms full edit access on that session. Dashboard shows only B's own active sessions; sidebar badge reflects B's own non-completed count only.

**Files touched this entry:**
- `packages/web/src/components/layout/Sidebar.tsx` (+ active-count fetch + badge)
- `packages/web/src/pages/DashboardPage.tsx` (empty state rewrite)
- `packages/web/src/pages/PastVisitsPage.tsx` (empty-state heading)
- `packages/web/src/__tests__/dashboard.test.tsx` (copy + sidebar-badge tests + mock pattern swap)
- `packages/web/src/__tests__/pastVisits.test.tsx` (empty copy)
- `packages/web/src/__tests__/routing.test.tsx` (empty copy)
- `CLAUDE.md` (new "FINALIZED" section + Past Visits empty-state note updated)

Feature `claude/dashboard-visibility-feat.md` is now fully shipped.

---

## 2026-04-14
### Entry #21 — Read-Only Mode on Active Visit Page (Non-Owner View)

Wraps up `claude/dashboard-visibility-feat.md` §3. After Entry #18 opened cross-physician reads on the backend, the Active Visit page still assumed the viewer owned the session. Now a non-owner sees a banner and a fully read-only page, and any stray write request surfaces a friendly toast.

**Plumbing — current-user resolution:**
- New `GET /api/auth/me` in `routes/auth.ts` returns the `Physician` row for the authenticated Clerk user (404 if the physician record isn't synced yet).
- New `useCurrentPhysician` hook fetches `/auth/me` once and returns `Physician | null`. Returns `null` while loading or on failure — the page treats `null` as "assume owner" to avoid a read-only flash for owners before the lookup resolves.

**New component — `components/visit/OwnershipBanner.tsx`:**
- Blue info banner with `role="status"`, `data-testid="ownership-banner"`, and an `Eye` icon. Copy: "This visit was conducted by Dr. <Name>. You are viewing in read-only mode." Only ever rendered when we *know* the viewer isn't the owner.

**`ActiveVisitPage.tsx` rewiring:**
- `knownNonOwner = !!currentPhysician && !!session && currentPhysician.id !== session.physicianId`. `isOwner = !knownNonOwner` (optimistic — owners don't flicker). Only the banner uses `knownNonOwner` directly.
- Renders `<OwnershipBanner />` between the header and the vitals section.
- Vitals section: when not owner, renders `VitalsDisplay` without `onEdit` (which is now optional — see below) if vitals exist, or a small "No vitals recorded." placeholder otherwise. `VitalsForm` is never instantiated for non-owners.
- `AudioRecorder` receives `readOnly={!isOwner}`.
- `SoapNoteEditor` now gets `readOnly={isApproved || !isOwner}` (was just `isApproved`).
- `SoapWorkflowActions` is gated behind `isOwner && session?.soapNote`.
- Transcript (`TranscriptViewer` is already read-only) and audit timeline are untouched — they stay fully visible for everyone, which matches the spec.
- All handlers (`runTranscription`, `handleSaveDraft`, `handleRequestReview`, `handleApprove`) branch on a new `isForbiddenError` helper. On `API 403: ...` they show "You can only modify sessions you created." instead of the generic failure toast, covering the devtools-tamper case.

**`AudioRecorder.tsx`:**
- New optional `readOnly?: boolean` prop. When true, the Start/Stop buttons are hidden and a `data-testid="audio-readonly-placeholder"` message ("Recording controls are hidden in read-only mode.") renders in their place. Playback + upload status sections remain intact for any in-session state.

**`VitalsDisplay.tsx`:**
- `onEdit` is now optional. When omitted, the edit button row is suppressed entirely — lets the parent render the component in display-only mode without exposing a non-functional button.

**Tests — `ownership.test.tsx` (8 new):**
- Shared fixtures build a session owned by `PHYSICIAN_LEE` with vitals + a DRAFT SOAP note; `configureMockGet` routes `/auth/me` to the caller-specified current user and `/sessions/:id` to the session.
- Owner view (current user === session.physicianId):
  - No `ownership-banner` in the DOM.
  - `vitals-edit` button visible.
  - `Save Draft` button visible.
- Non-owner view (current user !== session.physicianId):
  - `ownership-banner` present, contains `Dr. James Lee` and "read-only".
  - `start-recording-btn` absent; `audio-readonly-placeholder` present.
  - `vitals-display` present, `vitals-edit` absent.
  - None of `Save Draft` / `Request Review` / `Sign & Finalize` rendered.
  - SOAP content still visible via `getByDisplayValue("Patient reports headache")` — the editor falls through to its read-only textarea form.

**Files:**
- `packages/server/src/routes/auth.ts` (+ `GET /me`)
- `packages/web/src/hooks/useCurrentPhysician.ts` (new)
- `packages/web/src/components/visit/OwnershipBanner.tsx` (new)
- `packages/web/src/components/audio/AudioRecorder.tsx` (+ `readOnly`)
- `packages/web/src/components/vitals/VitalsDisplay.tsx` (`onEdit` optional)
- `packages/web/src/pages/ActiveVisitPage.tsx` (ownership wiring + 403 toasts)
- `packages/web/src/__tests__/ownership.test.tsx` (new)
- `CLAUDE.md` (new Current Phase section)

---

### Entry #20 — Past Visits Redesign: Practice-Wide Archive

Frontend slice of `claude/dashboard-visibility-feat.md` §2. Past Visits used to be a personal-scope list of the logged-in physician's visits with client-side search and a tiny status-pill filter. It's now the practice-wide archive — every visit from every physician — with server-driven filtering.

**`PastVisitsPage.tsx` rewrite:**
- Fetches `/sessions?scope=all` and rebuilds the query string whenever any filter changes (search, physician, status). No more `useMemo` client-side filter — the backend already supports all of this after Entry #18.
- Search input debounces for 300ms before updating `debouncedSearch`, which is the actual dependency in the fetch `useEffect`. So typing doesn't thrash the API.
- Filter bar sits below the search box:
  - `PhysicianFilter` (new component, see below) → `?physician=<id>` when selected.
  - Status `<select>` with all 6 options (`All Statuses` + every `SessionStatus` value) → `?status=<value>` when not `ALL`.
- Each result row uses the existing `VisitCard`, which already displays `Dr. <Physician.fullName>` from Entry #17. Status badge + chevron remain.
- Empty state consolidated to a single "No visits found" message with `data-testid="past-visits-empty"` (replaces the old "No visits yet" / "No matching visits" split). This is an intentional simplification — the page is never "empty because you haven't done anything" anymore; it's practice-wide.
- Skeleton loader (`data-testid="past-visits-loading"`) renders while any fetch is in flight — not just the initial one — because filter changes should feel responsive.
- Subtitle copy updated: "Practice-wide archive of all visits across physicians."

**New component — `components/visit/PhysicianFilter.tsx`:**
- Self-contained: fetches `/physicians` on mount via `useApi`, renders a native styled `<select>` with a `Users` icon. Options are `All Physicians` (value `""`) followed by every physician as `Dr. <fullName>`.
- Controlled via `{ value: string | null; onChange: (id: string | null) => void }`. Emits `null` when the user picks `All Physicians`, which the page translates into "don't send `physician` query param at all."
- Exports `PhysicianOption = { id, fullName }` since that's exactly the shape `/api/physicians` returns (no need to reuse the heavy `Physician` type from `types.ts`).
- Exposes `data-testid="physician-filter"` and a descriptive `aria-label` for test queries and a11y.
- The spec said "shadcn/ui Select" but the codebase doesn't have the shadcn Select primitive installed — everything else in `components/ui/` is hand-rolled Tailwind. Kept the native `<select>` styled to match the search input and existing form elements rather than introducing the shadcn Select dependency mid-feature. Can be swapped later without changing the component's public interface.

**Tests — `pastVisits.test.tsx` (8 new):**
- Shared `configureMockGet` helper routes `/physicians` and `/sessions?...` URLs to in-memory fixtures. The sessions handler honors `search`/`physician`/`status` query params, so the page's real URL-building is exercised end-to-end.
- `PastVisitsPage`:
  - Calls `/sessions?scope=all` on mount.
  - Renders rows from multiple physicians, each with its `visit-card-physician` tag.
  - Search input, after debounce, triggers a call containing `search=Garcia` and narrows the visible list.
  - Physician dropdown triggers `physician=phys-lee` and narrows the list accordingly.
  - Status dropdown triggers `status=IN_REVIEW` and narrows the list accordingly.
  - Empty API response renders the `past-visits-empty` state with "No visits found".
- `PhysicianFilter` (standalone):
  - Renders `Dr. <fullName>` for each physician returned by the API + the default "All Physicians" option.
  - `onChange` receives the selected id when a physician is picked and `null` when "All Physicians" is re-selected.
- `routing.test.tsx` smoke test updated: `getByText("No visits yet")` → `getByText("No visits found")` to match the new empty-state copy.

**Files touched:**
- `packages/web/src/pages/PastVisitsPage.tsx` (rewrite)
- `packages/web/src/components/visit/PhysicianFilter.tsx` (new)
- `packages/web/src/__tests__/pastVisits.test.tsx` (new, 8 tests)
- `packages/web/src/__tests__/routing.test.tsx` (empty-state copy update)
- `CLAUDE.md`

Web test suite run skipped per user instruction — will be verified manually.

---

### Entry #19 — Dashboard Redesign: Active Work Queue

Frontend slice of `claude/dashboard-visibility-feat.md` §1 — the dashboard is no longer a generic visit list. It's now focused on what the logged-in physician still needs to do.

**`DashboardPage.tsx` rewrite:**
- Fetches `GET /api/sessions?scope=mine` (the new scope param from Entry #18) and derives everything client-side.
- Three stat cards in a responsive grid:
  - **In Progress** — sessions with status `RECORDING | TRANSCRIBING | GENERATING_NOTE`.
  - **Awaiting Review** — sessions with status `IN_REVIEW`.
  - **Completed This Week** — sessions with status `COMPLETED` whose `recordedAt` is within the last 7 days (client-side date filter, no second fetch needed since `scope=mine` already returns completed ones).
- Prominent Start New Visit CTA below the stats (blue pill, same style as elsewhere).
- Active session list filters out `COMPLETED` and renders each remaining session via the new `ActiveSessionCard`. Skeleton placeholders during load.
- Empty state when `activeSessions.length === 0`: dashed slate card with "No active sessions. Start a new visit or view past visits." The "view past visits" fragment is an inline button that navigates to `/visits`.
- "View all past visits →" link below the list (bottom-right) for the non-empty case too.
- Greeting copy updated: "Here's what needs your attention today."

**New component — `components/visit/ActiveSessionCard.tsx`:**
- Similar shape to `VisitCard` but tailored for the dashboard: avatar, patient name + date on the top row, and an action-needed description on a second line driven by a `Record<Exclude<SessionStatus, "COMPLETED">, string>` map:
  - `RECORDING` → "Visit started, awaiting recording"
  - `TRANSCRIBING` → "Audio uploaded, transcription in progress"
  - `GENERATING_NOTE` → "Transcript ready, generating SOAP note"
  - `IN_REVIEW` → "SOAP note draft ready for review"
- Exposes `data-testid="active-session-card"` and `data-status={status}` for deterministic test queries. Clicking navigates to `/visits/:id`.
- Physician name is intentionally omitted — every card is the current physician's own work.

**Tests — `dashboard.test.tsx` (10 new):**
- `DashboardPage`: fetches with `scope=mine`; stat counts are correct across a mixed fixture (3 in-progress, 2 in-review, 2 completed-this-week, 1 completed-10-days-ago ignored); active list contains only non-completed rows; empty state renders when every session is completed; greeting includes first name from mocked Clerk user; Start New Visit CTA renders.
- `ActiveSessionCard`: parameterized `it.each` over all four non-completed statuses verifying the correct action-needed copy and `data-status` attribute.
- Dashboard-specific `vi.hoisted` API mock so the fetch can be stubbed per test. Scoped to this file — doesn't touch the existing `routing.test.tsx` dashboard smoke test, which continues to pass since the greeting + Start New Visit button assertions still hold.

**Files touched:**
- `packages/web/src/pages/DashboardPage.tsx` (rewrite)
- `packages/web/src/components/visit/ActiveSessionCard.tsx` (new)
- `packages/web/src/__tests__/dashboard.test.tsx` (new, 10 tests)
- `CLAUDE.md`

Dashboard test file run in isolation: **10/10 passing** (`npx vitest run src/__tests__/dashboard.test.tsx`, ~3.2s). Full web suite run skipped at user request.

---

### Entry #18 — Cross-Physician Visibility: Backend (scoped queries + ownership writes)

Backend slice of `claude/dashboard-visibility-feat.md` — opens up read access practice-wide while keeping writes owner-scoped. Frontend changes (dashboard redesign, past visits redesign, ownership banner) are not part of this entry.

**New helper (`packages/server/src/lib/requireSessionOwner.ts`):**
- `requireSessionOwner(sessionId, physicianId)` → `{ ok: true, session } | { ok: false, status: 404 | 403, error }`. Thin async wrapper around a `select: { id, physicianId }` lookup. Non-owner returns the standardized message `"You can only modify sessions you created"` so the frontend can render a consistent error.

**`GET /api/sessions` — scoped queries (`packages/server/src/routes/sessions.ts`):**
- `?scope=mine` (default): `where.physicianId = currentPhysician.id`. Matches the pre-existing dashboard behavior.
- `?scope=all`: no physician scoping; optional `?physician=<id>` narrows to a specific owner.
- `?search=<text>`: Postgres case-insensitive partial match on `patient.fullName` OR `patient.mrn` via Prisma's `{ contains, mode: "insensitive" }`.
- Existing `?status=` filter works with both scopes (unchanged validation).
- Every response row includes `physician: { id, fullName }` so the past-visits UI can display ownership without a second fetch.
- Invalid `scope` value → 400.

**`GET /api/sessions/:id` — practice-wide read:**
- Removed the old `session.physicianId !== physician.id → 403` check. Any authenticated physician can now view any session's full detail (patient, transcript, SOAP note, vitals, audit events).
- Physician include switched to `select: { id, fullName, credentials }` so the frontend ownership banner has everything it needs.
- `GET /api/sessions/:id/audit-events` also opened up (practice-wide read per spec — "View any audit trail").

**Ownership checks on write endpoints:**
All of the following now call `requireSessionOwner` and return `403 { error: "You can only modify sessions you created" }` on non-owner:
- `POST /api/sessions/:id/upload-audio` (also deletes the uploaded multer file on 403/404)
- `POST /api/sessions/:id/transcribe`
- `POST /api/sessions/:id/generate-soap`
- `PUT /api/sessions/:id/soap-note`
- `POST /api/sessions/:id/soap-note/submit-review`
- `POST /api/sessions/:id/soap-note/approve`
- `POST /api/sessions/:id/vitals` (via `loadAuthorizedSession` in `routes/vitals.ts`)
- `PUT /api/sessions/:id/vitals` (same)

The vitals router's existing `loadAuthorizedSession` helper was refactored to delegate to `requireSessionOwner` so the error shape is consistent across routers.

**New endpoint — `GET /api/physicians` (`packages/server/src/routes/physicians.ts`):**
- Returns `[{ id, fullName }]` ordered by fullName. Used by the physician filter dropdown on the Past Visits page. Registered in `index.ts`; requires auth via the existing global Clerk middleware. No sensitive fields exposed.

**Test updates:**
- `sessions.test.ts` — flipped the "returns 403 when session belongs to another physician" case on `GET /:id` to a new assertion that cross-physician read returns 200 with the other physician's fullName/id in the response.
- `auditEvents.test.ts` — same flip: the "other physician" case now asserts 200 with an array body.

**New test file — `crossPhysicianVisibility.test.ts` (25 tests):**
- Sets up two physicians (`Owner Doc`, `Other Doc`) and two patients (`Sarah Johnson`, `Maria Garcia`) plus DRAFT/PENDING_REVIEW soap-note sessions owned by each.
- `GET /api/sessions` scope tests: default=mine, explicit scope=mine, scope=all (both physicians), scope=all&physician=<id>, scope=all&search=johnson (case-insensitive), scope=all&search=Garcia, status filter with scope=all, invalid scope → 400, recordedAt ordering desc.
- `GET /api/sessions/:id` cross-physician read — asserts 200 + physician relation has id/fullName/credentials.
- Non-owner 403 probes for every write endpoint (8 endpoints) — all assert both status 403 and the exact error string.
- Owner happy-path assertions for `PUT /soap-note`, `submit-review`, `approve`, `POST /vitals`, `PUT /vitals` (the other owner paths are already covered in `sessions.test.ts` and `soapWorkflow.test.ts`).
- `GET /api/physicians` — returns array with both physicians, each row has exactly `{ id, fullName }`, and 401 without auth.

**Suite status:** **154/154 passing** across 12 test files (`npx vitest run` in `packages/server`, ~5.4s). No existing tests broken.

**Files touched:**
- `packages/server/src/lib/requireSessionOwner.ts` (new)
- `packages/server/src/routes/sessions.ts`
- `packages/server/src/routes/vitals.ts`
- `packages/server/src/routes/physicians.ts` (new)
- `packages/server/src/index.ts`
- `packages/server/src/__tests__/sessions.test.ts`
- `packages/server/src/__tests__/auditEvents.test.ts`
- `packages/server/src/__tests__/crossPhysicianVisibility.test.ts` (new)
- `CLAUDE.md`

Next up on this feature: frontend dashboard/past-visits redesign, ownership banner, and disabling edit controls when viewing another physician's session.

---

## 2026-04-14
### Entry #17 — Enhanced Patient Management: Final Polish, Cross-Linking, Clean Seed

Closing phase of the feature — cross-surface polish, cleaner demo data, and a few rough-edge fixes discovered while preparing to demo.

**Seed rewrite (`packages/server/prisma/seed.ts`):**
- Removed all fake visits, transcripts, SOAP notes, and audit events — those artifacts are only meaningful when produced from real audio, so they should come from actual usage, not seed data.
- Kept a single demo physician record (`Sarah Smith`, `demo_clerk_id`) so `AuthSync` can still recognize the demo Clerk identity on first login.
- Expanded from 3 to 6 demo patients, each with a full profile (sex, heightCm, eyeColor, bloodType) and 1–3 realistic allergies + medications: James Okafor, Maria Chen, Robert Patel, Sarah Johnson, David Rodriguez, Emily Nakamura. Idempotent via upsert + `deleteMany` of allergies/medications before re-inserting.
- Physician `fullName` is now stored without the "Dr." honorific. The UI prepends it consistently, so storing it in the record was causing "Dr. Dr. Sarah Smith" in places like `VisitCard` and `PatientVisitHistory`.

**Cross-linking — physician name on visit cards (`packages/web/src/components/visit/VisitCard.tsx`):**
- Added `Dr. {session.physician.fullName}` between the patient name and the recorded-at timestamp, with a middot separator. Renders only when the physician is present on the session, so fixtures that omit it (e.g. the existing `components.test.tsx` visit card tests) keep working. A `data-testid="visit-card-physician"` hook is added for future assertions.
- Because `DashboardPage` and `PastVisitsPage` both render `VisitCard`, this single edit fulfills the "show physician name on Dashboard and Past Visits" ask in one place.
- `NewVisitPage` already consumed the `/patients?search=` endpoint which returns the expanded profile + `_count`, so no changes were needed there.

**Polish:**
- `PatientDetailPage.tsx` — replaced the `Loader2` spinner with a two-column skeleton that mirrors the real layout (visit-history rows on the left, sticky profile card on the right). Gives the page a much less jarring load-in.
- `AllergyList.tsx` empty state: "No allergies recorded." → **"No known allergies."** (matches clinical phrasing).
- `MedicationList.tsx` empty state: "No medications recorded." → **"No current medications."**
- `PatientListPage` already had skeletons + empty states from Phase 3; no change needed.
- Error toasts for allergy/medication/vitals operations were already in place from their respective phases.
- `ActiveVisitPage` vitals section already handles pre-feature sessions correctly — when `session.vitals` is null it falls through to `VitalsForm`, so legacy sessions don't break.

**Database:**
- Wiped dev DB with `npx prisma migrate reset --force --skip-seed` then reseeded via `npx ts-node --transpile-only prisma/seed.ts`. Clean starting state for the demo: 1 physician, 6 patients with profiles/allergies/medications, zero sessions.

**Tests:** `patientDetail.test.tsx` (20), `vitals.test.tsx` (13), `patientList.test.tsx` (9) — **42/42 passing** after the empty-state string change was mirrored in the allergy empty-state test. Full web suite run skipped at user request (the harness is a known hold-up).

**Files touched:**
- `packages/server/prisma/seed.ts`
- `packages/web/src/components/visit/VisitCard.tsx`
- `packages/web/src/components/patient/AllergyList.tsx`
- `packages/web/src/components/patient/MedicationList.tsx`
- `packages/web/src/pages/PatientDetailPage.tsx`
- `packages/web/src/__tests__/patientDetail.test.tsx`

Enhanced Patient Management feature is now complete end-to-end: schema → API → patient list → patient detail (profile + allergies + meds + visit history) → vitals on Active Visit → cross-linking + polish + clean demo seed.

---

### Entry #16 — Enhanced Patient Management: Vitals on Active Visit Page

Phase 5 of the feature — vitals entry/display on the Active Visit page. New `VitalsForm` and `VitalsDisplay` components plus wiring into `ActiveVisitPage`. 13 new tests pass.

**New components (`packages/web/src/components/vitals/`):**
- `VitalsForm.tsx` — 7 labeled number inputs in a responsive 1/2/3-column grid: weight (kg, step 0.1), BP systolic (mmHg, 60–250), BP diastolic (mmHg, 40–150), heart rate (bpm, 30–250), temperature (°C, step 0.1, 34–42), respiratory rate (/min, 8–60), SpO₂ (%, step 0.1, 70–100). Each input has an inline unit label. Empty strings are sent as `null`. On submit, POSTs to `/api/sessions/:id/vitals` on new entry or PUTs when `initial` vitals are provided. Loading spinner + toast on save. Optional Cancel button when editing existing vitals.
- `VitalsDisplay.tsx` — read-only grid showing each vital with its value and unit. Abnormal highlighting via `data-severity="normal"|"borderline"|"critical"` plus yellow/red background tints. Thresholds:
  - HR: borderline >100 or <60, critical >120 or <50
  - Temp: borderline >38°C, critical >39°C
  - SpO₂: borderline <95%, critical <90%
  - BP systolic: borderline >140 or <90, critical >180 or <80
  - Null values render as "--" with the unit hidden. Pencil "Edit" button switches the parent back to `VitalsForm`.

**Page wiring (`packages/web/src/pages/ActiveVisitPage.tsx`):**
- Imports `VitalsForm`, `VitalsDisplay`, and the `Activity` icon. New `Vitals` type import.
- New `editingVitals` boolean state drives the form/display toggle.
- `handleVitalsSaved(v)` merges vitals into `session`, exits edit mode, and re-fetches audit events (so the `VITALS_RECORDED` event lands in the sidebar timeline).
- A new `<section data-testid="vitals-section">` is rendered directly between the visit header and the Audio Recording panel: shows `VitalsDisplay` when vitals exist and we're not editing, otherwise `VitalsForm`. Cancel is only offered when editing existing vitals.

**Tests (`packages/web/src/__tests__/vitals.test.tsx` — 13 new):**
- VitalsForm: all 7 inputs render with the correct type/step/min/max; unit labels render; empty submit sends POST with nulls; pre-filled submit sends PUT (verifies `initial` -> edit mode path); `onSaved` is invoked with the API response.
- VitalsDisplay: values render with units; nulls render as "--" with units hidden; HR 110→borderline / 130→critical; Temp 38.5→borderline / 39.5→critical; SpO₂ 93→borderline / 88→critical; BP systolic 150→borderline / 190→critical; normal values render with `data-severity="normal"`; Edit button fires `onEdit`.

**Suite status:** `vitals.test.tsx` 13/13 ✅ (run in isolation). Full suite rerun skipped at user request.

---

### Entry #15 — Enhanced Patient Management: Patient Detail Page (Frontend)

Phase 4 of the feature — the clinical home base for each patient. Two-column layout at `/patients/:id`: scrollable visit history on the left, sticky profile on the right with allergies and medications. All CRUD wired to existing backend endpoints; 20 new tests pass.

**New components (`packages/web/src/components/patient/`):**
- `PatientProfile.tsx` — demographics display (name, DOB, MRN, sex, height, eye color, blood type). "Edit" button swaps the view for an inline form; Save calls `PUT /api/patients/:id` and bubbles the updated patient up via `onUpdated`. Cancel exits without a request.
- `AllergyList.tsx` — severity-colored chips (red/yellow/green, gray fallback) rendered with `data-severity` for testable styling. Inline "Add Allergy" form (name + severity dropdown + reaction). Per-chip delete button. POST/DELETE under `/patients/:id/allergies[/:allergyId]`.
- `MedicationList.tsx` — compact rows showing name, dosage, frequency. Pencil opens an inline edit form pre-filled with current values; trash deletes. Add/Edit share one form with a `mode` state machine (`"idle" | "add" | "edit"`). Uses POST/PUT/DELETE under `/patients/:id/medications[/:medicationId]`.
- `PatientVisitHistory.tsx` — "Start New Visit" button POSTs to `/api/sessions` with `{ patientId }` and navigates to `/visits/:id`. Chronological list (most recent first) of session rows showing date, physician name, `StatusBadge`, and a SOAP workflow-status pill when a note exists. Empty state when no visits.

**Page (`packages/web/src/pages/PatientDetailPage.tsx`):**
- Fetches patient on mount via `usePatient.fetchPatient(id)`; cancel-guarded.
- Left column (`flex-1`) hosts `PatientVisitHistory`; right column (`lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]`) is the profile card containing `PatientProfile` + `AllergyList` + `MedicationList`, all kept in sync via local state setters passed down as `onChange` callbacks.
- `showToast` intentionally omitted from the fetch effect's dep array — its identity changes on every provider render, which would loop the fetch after any toast fired.
- Loading spinner, "Patient not found" fallback, back link to `/patients`.

**Tests (`packages/web/src/__tests__/patientDetail.test.tsx` — 20 new):**
- PatientProfile: renders all fields, em-dash fallbacks, edit mode saves via PUT, cancel doesn't call PUT.
- AllergyList: severity `data-severity` attribute per chip, empty state, add POSTs + calls onChange, delete calls DELETE + onChange.
- MedicationList: renders name/dosage/frequency, add POSTs, edit opens pre-filled form + PUTs, delete.
- PatientVisitHistory: visit rows with physician name and StatusBadge, empty state, SOAP pill when note present, Start New Visit POST+navigate, row click navigates.
- PatientDetailPage: full fetch + two-column render, sticky class on right column, patient-not-found on fetch failure.

**Suites:** web 69+ / server 129 — all passing.

---

### Entry #14 — Enhanced Patient Management: Patient List Page (Frontend)

Phase 3 of the feature — frontend list page and navigation. Users can now browse, search, and create patients from `/patients`.

**API client (`packages/web/src/lib/api.ts`):**
- Added `del(path)` method (stable `useCallback` ref) — returns void, throws on non-2xx.

**Types (`packages/web/src/lib/types.ts`):**
- `Patient` expanded with `sex | heightCm | eyeColor | bloodType` and optional list-mode `_count` / detail-mode `allergies`, `medications`, `sessions`.
- New `Allergy`, `Medication`, `Vitals`, `PatientSummary` interfaces.
- `Session` gained optional `vitals`.

**Domain hook (`packages/web/src/hooks/usePatient.ts`):**
- `fetchPatients(search?)`, `fetchPatient(id)`, `createPatient`, `updatePatient`, `addAllergy`, `deleteAllergy`, `addMedication`, `updateMedication`, `deleteMedication` — all stable refs via `useCallback`.

**Components / pages:**
- `components/patient/PatientCard.tsx` — button card with name, MRN, DOB, visit count, allergy count; navigates to `/patients/:id`; amber highlight when allergies > 0.
- `pages/PatientListPage.tsx` — fetches on mount, debounced search (300ms → `?search=`), skeleton loading state, empty state, inline "Add New Patient" form covering fullName/DOB/MRN/sex/heightCm/eyeColor/bloodType, toast on success.
- `pages/PatientDetailPage.tsx` — placeholder with back link (full detail UI is Phase D).

**Routing & nav:**
- `App.tsx` — new routes `/patients` and `/patients/:id`.
- `components/layout/Sidebar.tsx` — "Patients" entry (Users icon) inserted between Dashboard and Past Visits.

**Tests:**
- `__tests__/patientList.test.tsx` — 9 new tests: PatientCard rendering (name/MRN/DOB/counts), pluralization, zero-count fallback, detail-link aria-label; PatientListPage API fetch + footer count, empty state, debounced search with `?search=`, create-form open, create-form submit posting to `/patients`.
- `__tests__/routing.test.tsx` — updated sidebar assertions to include Patients link and verify ordering + href.
- `__tests__/components.test.tsx` — fixture patched for new Patient profile fields.

**Server suite:** 129/129 passing (unchanged from Entry #13 — no backend changes in this entry).

---

### Entry #13 — Enhanced Patient Management: API Endpoints

Phase 2 of the feature — API layer. Added allergy, medication, and vitals endpoints; expanded the existing patient/session routes to include new fields and nested data. 129 server tests passing (24 new).

**New routes (`packages/server/src/routes/patients.ts`):**
- `POST /api/patients/:id/allergies` — body `{ name (required), severity?, reaction? }`, returns 201 + allergy. 404 if patient missing, 400 if name missing.
- `DELETE /api/patients/:id/allergies/:allergyId` — 204 on success; 404 if allergy doesn't belong to the specified patient.
- `POST /api/patients/:id/medications` — body `{ name (required), dosage?, frequency? }`.
- `PUT /api/patients/:id/medications/:medicationId` — partial update of name/dosage/frequency. 404 if not owned by patient.
- `DELETE /api/patients/:id/medications/:medicationId` — 204 on success.

**New file (`packages/server/src/routes/vitals.ts`):**
- `POST /api/sessions/:id/vitals` — accepts partial vitals, verifies session ownership via Clerk physician lookup, 409 if vitals already exist, creates a `VITALS_RECORDED` audit event (inside a transaction).
- `PUT /api/sessions/:id/vitals` — partial update; 404 when vitals don't yet exist.
- Router mounted in `src/index.ts` with `mergeParams: true` at `/api/sessions/:id/vitals` (before the sessions router).

**Updated routes:**
- `POST /api/patients` + `PUT /api/patients/:id` — now accept `sex`, `heightCm`, `eyeColor`, `bloodType`. Strings trimmed; empty string → null.
- `GET /api/patients` — each patient includes `_count: { allergies, medications, sessions }`.
- `GET /api/patients/:id` — includes `allergies` (asc by createdAt), `medications` (asc), and `sessions` (desc by recordedAt) where each session carries `{ id, status, recordedAt, physician: { fullName }, soapNote: { workflowStatus } }`.
- `GET /api/sessions/:id` — added `vitals` to the includes (physician was already included).
- `GET /api/sessions` — now selects `physician: { fullName }` alongside patient.

**Tests (`packages/server/src/__tests__/patientProfileApi.test.ts`):** 24 tests covering allergy/medication CRUD (happy path + 400/404 cross-patient protection), vitals POST/PUT (happy path, 409 conflict, 404 unknown session, 403 other-physician, PUT-before-POST 404), VITALS_RECORDED audit event, patient create/update with new profile fields, patient list `_count`, patient detail nested data with physician name, session detail vitals include, session list physician include.

**Key files:**
- `packages/server/src/routes/patients.ts`
- `packages/server/src/routes/vitals.ts`
- `packages/server/src/routes/sessions.ts`
- `packages/server/src/index.ts`
- `packages/server/src/__tests__/patientProfileApi.test.ts`

---

## 2026-04-14
### Entry #12 — Enhanced Patient Management: Schema + Seed + Tests

Phase 1 of the Enhanced Patient Management feature — database layer only. Expanded the `Patient` model with profile fields and added `Allergy`, `Medication`, and `Vitals` models. 112 server tests passing (105 shown, 7 new).

**Schema (`packages/server/prisma/schema.prisma`):**
- `Patient` gained `sex`, `heightCm`, `eyeColor`, `bloodType` (all optional) plus `allergies` and `medications` relations.
- `Allergy` — `id`, `patientId`, `name`, `severity?`, `reaction?`, `createdAt`. `onDelete: Cascade` from Patient.
- `Medication` — `id`, `patientId`, `name`, `dosage?`, `frequency?`, `createdAt`. `onDelete: Cascade` from Patient.
- `Vitals` — one-to-one with `Session` (unique `sessionId`). Fields: `weightKg`, `bloodPressureSys/Dia`, `heartRate`, `temperatureC`, `respiratoryRate`, `oxygenSaturation`, `recordedAt`.
- Migration: `20260415002350_add_patient_profile_allergies_medications_vitals`.

**Seed (`packages/server/prisma/seed.ts`):**
- Three demo patients each get sex, height, eye color, blood type.
- James Okafor: Penicillin (Severe, Anaphylaxis), Pollen (Mild). Loratadine 10mg PRN.
- Maria Chen: Latex (Moderate, Dermatitis). Sertraline 50mg daily, Ibuprofen 400mg PRN.
- Robert Patel: Sulfa drugs (Moderate, Rash). Lisinopril 10mg daily, Metformin 500mg BID.
- Existing demo session (James Okafor cough visit) now has vitals (BP 128/82, HR 76, Temp 36.8°C, RR 16, SpO2 98%, 82.5kg). Seed re-runs idempotently — allergies/medications are replaced on each run, vitals upserted.

**Tests (`packages/server/src/__tests__/patientProfile.test.ts`):** 7 new tests —
- New profile fields save and retrieve correctly; all nullable.
- Allergy creation + relation fetch with severity/reaction.
- Medication creation + relation fetch with dosage/frequency.
- Cascade delete: removing a patient deletes their allergies and medications.
- Vitals creation and session relation fetch.
- `Vitals.sessionId` unique constraint prevents duplicate vitals per session.

**Key files:**
- `packages/server/prisma/schema.prisma`
- `packages/server/prisma/seed.ts`
- `packages/server/prisma/migrations/20260415002350_add_patient_profile_allergies_medications_vitals/`
- `packages/server/src/__tests__/patientProfile.test.ts`

---

## 2026-04-10
### Entry #10 — Phase 10: Audit Trail & Version History

Proper AuditTimeline component with icons/badges/metadata expansion wired into the right panel. Dedicated audit-events endpoint. 184 total tests passing (98 server + 86 web).

**Backend (`packages/server`):**
- `GET /api/sessions/:id/audit-events` — returns all audit events for a session ordered by `createdAt ASC`. Auth-protected (401/403/404). All 7 event types verified present in the system (SESSION_CREATED, AUDIO_CAPTURED, TRANSCRIPT_GENERATED, SOAP_DRAFT_CREATED, SOAP_EDITED, REVIEW_REQUESTED, NOTE_APPROVED).

**Frontend (`packages/web`):**
- `src/components/audit/AuditTimeline.tsx` — full timeline component replacing the inline version in ActiveVisitPage. Features:
  - Vertical connecting line between events
  - Color-coded icon circles per event type (Users, Mic, FileText, Sparkles, PenLine, Eye, CheckCircle2 from lucide-react)
  - Color-coded badges: "Signed" (emerald) for NOTE_APPROVED, "Draft" (yellow) for SOAP_DRAFT_CREATED, "In Review" (sky) for REVIEW_REQUESTED, etc.
  - Formatted timestamp (HH:MM AM/PM) + author
  - Collapsible metadata section for SOAP_EDITED events showing which fields changed
  - Event count footer (`N events total`)
  - Empty state with History icon
- `src/pages/ActiveVisitPage.tsx` — replaced inline AuditTimeline, added separate `auditEvents` state, `fetchAuditEvents()` using `GET /sessions/:id/audit-events`. Audit events refresh automatically after save draft, request review, and approve actions. Initialized from session.auditEvents on load and transcribe response.

**Tests:**
- `packages/server/src/__tests__/auditEvents.test.ts` — 6 tests: events returned in chronological order (regardless of insertion order), all required fields present, empty array for session with no events, 401/404/403.
- `packages/web/src/__tests__/auditTimeline.test.tsx` — 16 tests: empty state, event count, description text, author display, icons per event type, badge labels and colors, metadata expand/collapse, event count footer (singular/plural).

**Key files:**
- `packages/server/src/routes/sessions.ts` (added audit-events route)
- `packages/server/src/__tests__/auditEvents.test.ts`
- `packages/web/src/components/audit/AuditTimeline.tsx`
- `packages/web/src/pages/ActiveVisitPage.tsx`
- `packages/web/src/__tests__/auditTimeline.test.tsx`

---

## 2026-04-10
### Entry #9 — Phase 9: Review & Approval Workflow

Full SOAP note workflow (DRAFT → PENDING_REVIEW → APPROVED) with editing, confirmation dialogs, toast notifications, and read-only approved state. 162 total tests passing (92 server + 70 web).

**Backend (`packages/server`):**
- `PUT /api/sessions/:id/soap-note` — accepts partial updates to any SOAP section. Blocked when `workflowStatus = APPROVED`. Creates `SOAP_EDITED` audit event with `metadata: { changedFields }` listing which fields actually changed.
- `POST /api/sessions/:id/soap-note/submit-review` — DRAFT → PENDING_REVIEW. Validates source status. Creates `REVIEW_REQUESTED` audit event.
- `POST /api/sessions/:id/soap-note/approve` — PENDING_REVIEW → APPROVED. Sets `approvedAt` and `approvedById`. Updates session to `COMPLETED`. Creates `NOTE_APPROVED` audit event. Validated: can't approve from DRAFT.
- All session includes updated to `soapNote: { include: { approvedBy: true } }` for physician name display.

**Frontend (`packages/web`):**
- `src/components/ui/Toast.tsx` — `ToastProvider` context + `useToast()` hook. Auto-dismiss after 3 seconds. `data-testid="toast-success"` / `data-testid="toast-error"`.
- `src/components/ui/ConfirmDialog.tsx` — modal with title, message, confirm/cancel buttons. `data-testid="confirm-dialog"`.
- `src/components/soap/SoapWorkflowActions.tsx` — conditionally renders: DRAFT → Save Draft + Request Review; PENDING_REVIEW → Save Draft + Sign & Finalize; APPROVED → nothing. Both destructive actions guarded by `ConfirmDialog`.
- `src/components/soap/SoapNoteEditor.tsx` — added `readOnly` prop; textareas get `readOnly` attribute, styling switches to `bg-slate-50`.
- `src/pages/ActiveVisitPage.tsx` — wired workflow handlers (`handleSaveDraft`, `handleRequestReview`, `handleApprove`), local `soapEdits` state for optimistic editing, `isApproved` flag, green "Approved" badge with physician name + date, `SoapWorkflowActions` rendered when SOAP note exists.
- `src/App.tsx` — wrapped with `ToastProvider`.
- `src/lib/types.ts` — added `approvedBy?: Physician | null` to `SoapNote`, `physician?: Physician` to `Session`.

**Tests:**
- `packages/server/src/__tests__/soapWorkflow.test.ts` — 15 tests: PUT saves + audit event, PUT blocked when APPROVED, submit-review transitions + audit event, submit-review blocked when not DRAFT, approve transitions + approvedAt/approvedById/session COMPLETED, approve blocked from DRAFT and APPROVED, 401/404 for all endpoints.
- `packages/web/src/__tests__/soapWorkflow.test.tsx` — 20 tests: DRAFT/PENDING_REVIEW/APPROVED button visibility, Request Review confirm dialog, Sign & Finalize confirm dialog (irreversible warning), onSaveDraft/onRequestReview/onApprove callbacks, saving disabled state, readOnly textarea attributes, onChange blocked when readOnly, ConfirmDialog render states.

**Key files:**
- `packages/server/src/routes/sessions.ts` (3 new routes)
- `packages/server/src/__tests__/soapWorkflow.test.ts`
- `packages/web/src/components/ui/Toast.tsx`
- `packages/web/src/components/ui/ConfirmDialog.tsx`
- `packages/web/src/components/soap/SoapWorkflowActions.tsx`
- `packages/web/src/components/soap/SoapNoteEditor.tsx`
- `packages/web/src/pages/ActiveVisitPage.tsx`
- `packages/web/src/App.tsx`
- `packages/web/src/lib/types.ts`
- `packages/web/src/__tests__/soapWorkflow.test.tsx`

---

## 2026-04-10
### Entry #8 — Phase 8: SOAP Note Generation

LLM-powered SOAP note generation via OpenAI-compatible SDK (DeepSeek default), auto-chained after transcription. 123 total tests passing (79 server + 44 web).

**Backend (`packages/server`):**
- Installed `openai` SDK
- `src/services/soapGeneration.ts` — `SoapGenerationService` class + exported `SOAP_SYSTEM_PROMPT`. Calls OpenAI-compatible API with `response_format: { type: "json_object" }`. Retries once on `SyntaxError` (malformed JSON); throws `"SOAP generation failed after retry"` if both attempts fail. Validates all 4 fields present.
- `POST /api/sessions/:id/generate-soap` — validates transcript exists, calls service, upserts `SoapNote`, updates session to `IN_REVIEW`, creates `SOAP_DRAFT_CREATED` audit event. Returns populated session.
- `POST /api/sessions/:id/transcribe` — now auto-chains SOAP generation if `LLM_API_KEY` is set. Returns session in `IN_REVIEW` with both `transcript` and `soapNote` populated.

**Frontend (`packages/web`):**
- `src/components/soap/SoapNoteEditor.tsx` — four color-coded sections (blue/green/yellow/purple). Loading spinner state, empty placeholder state, editable textareas with local state synced from prop via `useEffect`. `onChange(field, value)` callback.
- `src/pages/ActiveVisitPage.tsx` — extracts `soapContent` from `session.soapNote`, passes to `SoapNoteEditor` with `loading={generatingSoap || transcribing}`.

**Tests:**
- `packages/server/src/__tests__/soapGeneration.test.ts` — 11 tests: 4 SOAP fields returned, system prompt sent, transcript in user message, `json_object` format, retry on malformed JSON (2 calls), throw after 2 failures, throw on missing fields; endpoint: creates SoapNote + audit event + IN_REVIEW, 400 no transcript, 404 bad session, 401 no auth.
- `packages/server/src/__tests__/transcription.test.ts` — updated: mocks `SoapGenerationService`, expects `IN_REVIEW` status + `soapNote` in response.
- `packages/web/src/__tests__/soapNoteEditor.test.tsx` — 9 tests: loading/empty/content states, 4 section labels, textarea values, onChange callback, local state update.

**Key files:**
- `packages/server/src/services/soapGeneration.ts`
- `packages/server/src/routes/sessions.ts` (generate-soap route + transcribe chain)
- `packages/server/src/__tests__/soapGeneration.test.ts`
- `packages/server/src/__tests__/transcription.test.ts` (updated)
- `packages/web/src/components/soap/SoapNoteEditor.tsx`
- `packages/web/src/pages/ActiveVisitPage.tsx`
- `packages/web/src/__tests__/soapNoteEditor.test.tsx`

---

## 2026-04-10
### Entry #7 — Phase 7: Transcription Pipeline

AssemblyAI transcription with speaker diarization wired end-to-end. 123 total tests passing (68 server + 55 web).

**Backend (`packages/server`):**
- Installed `assemblyai` SDK
- `src/services/transcription.ts` — `TranscriptionService` class: calls `client.transcripts.transcribe()` with `speaker_labels: true`, maps first speaker → "Doctor" / others → "Patient" (clinical heuristic), converts ms→seconds, builds `plainText` as `"Speaker: text\n\nSpeaker: text"`, throws on error status
- `POST /api/sessions/:id/transcribe` — validates session exists + has `audioFileUrl` + checks `ASSEMBLYAI_API_KEY`, calls `TranscriptionService`, upserts `Transcript` record, updates session to `GENERATING_NOTE`, creates `TRANSCRIPT_GENERATED` audit event, returns updated session with full includes

**Frontend (`packages/web`):**
- `src/components/transcript/TranscriptViewer.tsx` — three states: loading (spinner + "Transcribing your recording…"), empty (dashed placeholder), content (chat-like layout: Doctor = blue-left, Patient = slate-right, `data-speaker` attr for querying, timestamps in MM:SS)
- `src/pages/ActiveVisitPage.tsx` — `handleUploadComplete` callback auto-calls `POST /sessions/:id/transcribe` after audio upload; `transcribing` state passed to `TranscriptViewer`; utterances parsed from `session.transcript.rawDiarizedText` JSON

**Tests:**
- `packages/server/src/__tests__/transcription.test.ts` — 9 tests: speaker mapping (first=Doctor), ms→seconds conversion, plainText format, empty utterances, error status throws; endpoint tests: creates Transcript + audit event, 400 on no audio file, 404 on bad session, 401 without auth
- `packages/web/src/__tests__/transcriptViewer.test.tsx` — 11 tests: loading state, empty state, utterance count, Doctor/Patient text, data-speaker attrs, blue/slate color classes, ml-auto alignment, MM:SS timestamp format

**Key files:**
- `packages/server/src/services/transcription.ts`
- `packages/server/src/routes/sessions.ts` (added transcribe route)
- `packages/server/src/__tests__/transcription.test.ts`
- `packages/web/src/components/transcript/TranscriptViewer.tsx`
- `packages/web/src/pages/ActiveVisitPage.tsx`
- `packages/web/src/__tests__/transcriptViewer.test.tsx`

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
