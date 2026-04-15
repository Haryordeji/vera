# Feature Spec: Dashboard Redesign & Cross-Physician Visibility

## Status: Completed

## Overview

Two related changes that improve how Vera handles multi-physician workflows:

1. **Dashboard vs Past Visits separation** — The dashboard becomes a focused "active work" view showing only the logged-in physician's in-progress sessions. Past Visits becomes a practice-wide searchable archive of all completed visits across all physicians.

2. **Cross-physician read access** — Any physician can view any session, transcript, and SOAP note for any patient (read access is practice-wide). Write access (editing, approving, uploading) remains scoped to the session's owning physician.

---

## Problem Statement

**Currently:** Dashboard and Past Visits show nearly identical information — both are lists of visits scoped to the logged-in physician. A physician cannot see visits conducted by other physicians, even for a shared patient. This breaks the clinical workflow where doctors need to read prior notes from other providers.

**After:** Dashboard answers "what do I need to do right now?" and Past Visits answers "what's happened with this patient/practice historically?"

---

## What Changes

### 1. Dashboard Redesign

The dashboard becomes an **active work queue** for the logged-in physician only.

**Content:**
- **Active Sessions** — sessions owned by the current physician that are NOT in `COMPLETED` status. These are visits that need action: recording, transcribing, generating notes, reviewing, or approving. Ordered by most recent first.
- **Quick Stats** — simple counts at the top: "X sessions in progress", "Y notes awaiting review", "Z visits completed this week"
- **Start New Visit** — prominent CTA, same as before

**What disappears from the dashboard:**
- Completed/approved visits — those belong in Past Visits now
- Any visits from other physicians — the dashboard is personal

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Dashboard                                               │
│                                                         │
│  ┌─────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ 3       │  │ 1            │  │ 12                │  │
│  │ In      │  │ Awaiting     │  │ Completed         │  │
│  │ Progress│  │ Review       │  │ This Week         │  │
│  └─────────┘  └──────────────┘  └───────────────────┘  │
│                                                         │
│  [Start New Visit]                                      │
│                                                         │
│  ── Your Active Sessions ──                             │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Sarah Johnson  •  Apr 14, 2026  •  ● In Review    │  │
│  │ SOAP note draft ready for approval                │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ James Wilson   •  Apr 14, 2026  •  ● Transcribing │  │
│  │ Audio uploaded, transcription in progress         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Maria Garcia   •  Apr 14, 2026  •  ● Recording    │  │
│  │ Visit started, awaiting recording                 │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  No more active sessions.                               │
│  View all past visits →                                 │
└─────────────────────────────────────────────────────────┘
```

Each active session card shows: patient name, date, status badge, and a brief description of what action is needed. Clicking navigates to `/visits/:id`.

### 2. Past Visits Redesign

Past Visits becomes the **practice-wide archive** — all visits from all physicians.

**Content:**
- All sessions regardless of physician, ordered by most recent first
- Filterable by: physician name, patient name, status, date range
- Searchable by patient name or MRN

**Key change:** The `GET /api/sessions` endpoint (or a new dedicated endpoint) no longer filters by the current physician when serving the Past Visits page.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Past Visits                                             │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🔍 Search by patient name or MRN               │    │
│  └─────────────────────────────────────────────────┘    │
│  Filters: [All Physicians ▾] [All Statuses ▾]          │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Sarah Johnson  •  Apr 14, 2026                    │  │
│  │ Dr. Sarah Smith  •  ● Approved                    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ James Wilson  •  Apr 12, 2026                     │  │
│  │ Dr. James Lee  •  ● Completed                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Sarah Johnson  •  Mar 28, 2026                    │  │
│  │ Dr. James Lee  •  ● Approved                      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  [Load More]                                            │
└─────────────────────────────────────────────────────────┘
```

Each visit card shows: patient name, date, physician name, and status badge. Clicking navigates to `/visits/:id`.

### 3. Cross-Physician Read/Write Access Model

**Read access (practice-wide):**
Any authenticated physician can:
- View any session detail (`GET /api/sessions/:id`)
- View any transcript
- View any SOAP note
- View any audit trail
- See all sessions for any patient on the Patient Detail page
- See all sessions in the Past Visits archive

**Write access (owner-only):**
Only the physician who owns the session can:
- Upload audio (`POST /api/sessions/:id/upload-audio`)
- Trigger transcription (`POST /api/sessions/:id/transcribe`)
- Trigger SOAP generation (`POST /api/sessions/:id/generate-soap`)
- Edit the SOAP note (`PUT /api/sessions/:id/soap-note`)
- Submit for review (`POST /api/sessions/:id/soap-note/submit-review`)
- Approve/finalize (`POST /api/sessions/:id/soap-note/approve`)
- Record or update vitals (`POST/PUT /api/sessions/:id/vitals`)

**Frontend enforcement:** When viewing a session owned by another physician, all edit controls (textareas, buttons, vitals form) are hidden or disabled. A subtle banner indicates "This visit was conducted by Dr. X" so it's clear why editing is unavailable.

### 4. API Changes

#### Modified Endpoints

| Endpoint | Current Behavior | New Behavior |
|---|---|---|
| `GET /api/sessions` | Returns only current physician's sessions | Accepts `?scope=mine` (default for dashboard) or `?scope=all` (for past visits). When `scope=all`, returns all sessions across physicians. Keep existing `?status=` filter. Add `?physician=` filter and `?search=` for patient name/MRN. |
| `GET /api/sessions/:id` | May be scoped to current physician | Returns the session regardless of which physician owns it (any authenticated physician can view). Include `physician` in the response. |
| `PUT /api/sessions/:id/soap-note` | No ownership check beyond auth | Add ownership check: reject with 403 if the current physician is not the session's physician. |
| `POST /api/sessions/:id/soap-note/submit-review` | No ownership check | Add 403 ownership check. |
| `POST /api/sessions/:id/soap-note/approve` | No ownership check | Add 403 ownership check. |
| `POST /api/sessions/:id/upload-audio` | No ownership check | Add 403 ownership check. |
| `POST /api/sessions/:id/transcribe` | No ownership check | Add 403 ownership check. |
| `POST /api/sessions/:id/generate-soap` | No ownership check | Add 403 ownership check. |
| `POST /api/sessions/:id/vitals` | No ownership check | Add 403 ownership check. |
| `PUT /api/sessions/:id/vitals` | No ownership check | Add 403 ownership check. |

#### New Query Parameters for `GET /api/sessions`

| Param | Type | Description |
|---|---|---|
| `scope` | `"mine"` or `"all"` | `mine` = current physician only (dashboard). `all` = practice-wide (past visits). Default: `mine`. |
| `physician` | UUID string | Filter by specific physician ID. Only applies when `scope=all`. |
| `search` | string | Search sessions by patient name or MRN. |
| `status` | SessionStatus | Existing filter, unchanged. |

### 5. Frontend Changes Summary

**New/modified components:**
- `DashboardPage` — rewritten: quick stats bar + active sessions list (non-completed, current physician only)
- `PastVisitsPage` — rewritten: practice-wide archive with search bar, physician filter dropdown, status filter
- `ActiveVisitPage` — add read-only mode when viewing another physician's session (hide edit controls, show ownership banner)
- `PhysicianFilter` — new dropdown component for filtering by physician on Past Visits page
- `OwnershipBanner` — small banner/notice component shown when viewing another physician's session

**Sidebar update:**
- No structural changes needed, but the dashboard should show a badge/count of active sessions if there are any
