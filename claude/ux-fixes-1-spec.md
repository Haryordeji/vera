# Feature Spec: UX Fixes — Navigation, Archive Pattern, Error States & Edit Mode

## Overview

A collection of UX issues identified during manual walkthrough. These are grouped into one feature spec because they're all relatively small, touch different parts of the app, and can be implemented sequentially.

---

## Issue 1: No Consistent Back Navigation

**Problem:** There's no back button across pages. If you navigate into a visit detail or patient detail, you have to use the sidebar or browser back button to return. This feels clunky, especially when drilling into a visit from the Patient Detail page (you want to go back to the patient, not the dashboard).

**Solution:** Add a contextual breadcrumb/back button to the top of every detail page. The back destination should be intelligent based on where you came from.

**Implementation:**

Add a `PageHeader` component used at the top of every page that supports:
- A back arrow button on the left
- The page title next to it
- Optional subtitle or metadata

Pages and their back targets:
| Page | Back Target | Display |
|---|---|---|
| `/patients/:id` (Patient Detail) | `/patients` | ← Back to Patients |
| `/visits/:id` (Active Visit) | Previous page (browser history) | ← Back |
| `/visits/new` (New Visit) | `/` (Dashboard) | ← Back to Dashboard |
| `/patients` (Patient List) | No back button (top-level nav) | — |
| `/visits` (Past Visits) | No back button (top-level nav) | — |
| `/` (Dashboard) | No back button (top-level nav) | — |
| `/settings` → `/profile` | No back button (top-level nav) | — |

For the Active Visit page, use `navigate(-1)` (browser history back) since you might arrive from the Dashboard, Past Visits, or Patient Detail — and you want to return to wherever you came from.

---

## Issue 2: No Delete/Archive Pattern for Sensitive Data

**Problem:** There's no way to remove visits or patients. But for medical data, hard deletes are dangerous — accidental deletion of a visit with an approved SOAP note would be a serious data loss issue.

**Solution:** Implement a soft-delete/archive pattern. Records are never permanently deleted through the UI. Instead, they're "archived" — hidden from default views but still in the database and recoverable.

**What can be archived:**
| Record | Archive behavior |
|---|---|
| **Sessions/Visits** | Archived visits disappear from the dashboard, past visits, and patient visit history. The data (audio, transcript, SOAP note) is preserved in the database. Can be unarchived. |
| **Patients** | Archived patients disappear from the patient list and can't be selected for new visits. Their visit history is preserved. Can be unarchived. |

**What is NOT archivable (use direct remove instead):**
| Record | Behavior |
|---|---|
| **Allergies** | Removed directly (behind edit mode — see Issue 4). Removing an allergy is a legitimate clinical action. |
| **Medications** | Removed directly (behind edit mode — see Issue 4). Stopping a medication is a legitimate clinical action. |

**Schema changes:**

Add an `archivedAt` nullable DateTime field to `Patient` and `Session`:

```prisma
model Patient {
  // ... existing fields ...
  archivedAt  DateTime?               // null = active, set = archived
}

model Session {
  // ... existing fields ...
  archivedAt  DateTime?               // null = active, set = archived
}
```

**API changes:**

| Endpoint | Change |
|---|---|
| `GET /api/patients` | Default to `WHERE archivedAt IS NULL`. Add `?includeArchived=true` param to show all. |
| `GET /api/sessions` | Default to `WHERE archivedAt IS NULL`. Add `?includeArchived=true` param. |
| `POST /api/patients/:id/archive` | Sets `archivedAt = now()`. Returns updated patient. |
| `POST /api/patients/:id/unarchive` | Sets `archivedAt = null`. Returns updated patient. |
| `POST /api/sessions/:id/archive` | Sets `archivedAt = now()`. Ownership check: only the session's physician can archive it. Creates an audit event. Returns updated session. |
| `POST /api/sessions/:id/unarchive` | Sets `archivedAt = null`. Ownership check. Creates an audit event. Returns updated session. |

**Frontend behavior:**

- **Patient Detail page:** Add an "Archive Patient" option in a dropdown menu or as a secondary action. Requires a confirmation dialog: "Are you sure you want to archive this patient? They will be hidden from the patient list but all data will be preserved."
- **Active Visit page:** Add an "Archive Visit" option (only visible to the session owner). Confirmation dialog: "Are you sure you want to archive this visit? It will be hidden from all visit lists but all data will be preserved."
- **Patient List page:** Add an "Archived" toggle or tab to optionally view archived patients. Archived patients shown with a muted/grayed style and an "Unarchive" action.
- **Past Visits page:** Add an "Include Archived" toggle. Archived visits shown with a muted style and an "Unarchive" action.

---

## Issue 3: "Failed to Load" Error on Zero Visits

**Problem:** When there are zero visits, the app shows a "failed to load" error instead of a proper empty state.

**Solution:** Audit all pages that fetch lists and ensure they correctly distinguish between "loading," "error," and "empty" states.

Pages to check:
- Dashboard (zero active sessions)
- Past Visits (zero visits, or zero matching filters)
- Patient Detail visit history (patient with no visits)
- Patient List (zero patients)

Each should show a friendly empty state message, not an error. The error state should only appear for actual API failures (network errors, 500s).

---

## Issue 4: Allergies & Medications Too Easy to Accidentally Delete

**Problem:** On the Patient Detail page, allergy delete buttons and medication edit/delete buttons are always visible. It's too easy to accidentally remove clinical data.

**Solution:** Lock allergy and medication modifications behind the "Edit Profile" mode. When the profile is in view mode, allergies and medications are display-only with no action buttons. When the user clicks "Edit Profile," the add/edit/delete controls for allergies and medications become visible alongside the editable profile fields. Clicking "Save" or "Cancel" exits edit mode and hides the controls again.

**Behavior:**

| State | Allergies | Medications |
|---|---|---|
| **View mode** (default) | Display as tags/chips. No delete buttons. No "Add Allergy" form. | Display as list. No edit/delete buttons. No "Add Medication" form. |
| **Edit mode** (after clicking "Edit Profile") | Delete X buttons appear on each tag. "Add Allergy" form is accessible. | Edit (pencil) and delete (trash) buttons appear. "Add Medication" form is accessible. |

This means the existing "Edit Profile" button controls editability for the entire left/right profile column: demographics, allergies, AND medications all toggle together.

---

## Issue 5: "Settings" Sidebar Tab Should Be "My Profile"

**Problem:** The sidebar says "Settings" but the page is really about the physician's own profile.

**Solution:** Rename "Settings" to "My Profile" in the sidebar and page header. Update the route from `/settings` to `/profile`. Update any navigation references.

---

## Summary of All Changes

| Area | Change |
|---|---|
| Navigation | Add `PageHeader` component with contextual back button to detail pages |
| Archive pattern | Add `archivedAt` to Patient and Session, archive/unarchive endpoints, UI controls with confirmation dialogs |
| Error states | Fix zero-visit "failed to load" — properly handle empty state vs error state on all list pages |
| Edit mode | Lock allergy/medication add/edit/delete behind "Edit Profile" toggle on Patient Detail page |
| Sidebar rename | "Settings" → "My Profile", route `/settings` → `/profile` |
