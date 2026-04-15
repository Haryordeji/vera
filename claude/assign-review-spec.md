# Feature Spec: Review Assignment Workflow

## Overview

Expand the SOAP note sign-off flow to support physician-to-physician review assignment. The owning physician can either self-approve (existing behavior) or assign the note to another physician for review. The assigned reviewer can approve the note or return it to draft with feedback. This showcases multi-physician collaboration and mirrors teaching hospital / group practice workflows.

---

## Current Flow

```
DRAFT → (Request Review) → PENDING_REVIEW → (Sign & Finalize) → APPROVED
```

All actions are performed by the same physician who owns the session. "Request Review" and "Sign & Finalize" are both self-service — there's no actual second physician involved.

## New Flow

```
DRAFT
  ├── Sign & Finalize (self-approve) ──────────────────→ APPROVED
  │
  └── Assign for Review (pick a physician) ────────────→ PENDING_REVIEW
                                                              │
                                              ┌───────────────┤
                                              │               │
                                        Reviewer:        Reviewer:
                                        Approve &        Return to
                                        Sign             Draft
                                              │               │
                                              ▼               ▼
                                          APPROVED         DRAFT
                                                       (with feedback)
```

**Key changes from current flow:**
- "Request Review" is replaced by "Assign for Review" which requires selecting a physician
- PENDING_REVIEW now has an `assignedReviewerId` — a specific person is responsible
- The assigned reviewer (not the owner) is the one who approves or returns the note
- Self-approval from DRAFT is still available for solo practice workflows
- The owner can still edit the note while it's in PENDING_REVIEW
- Returning to draft includes optional feedback text so the reviewer can explain what needs fixing

---

## Schema Changes

**SoapNote model — add two fields:**

```prisma
model SoapNote {
  // ... existing fields ...

  assignedReviewerId  String?              // Physician assigned to review this note
  reviewFeedback      String?              // Feedback from reviewer when returning to draft

  assignedReviewer    Physician?  @relation("AssignedReviewer", fields: [assignedReviewerId], references: [id])
}
```

**Physician model — add relation:**

```prisma
model Physician {
  // ... existing relations ...
  assignedReviews  SoapNote[]  @relation("AssignedReviewer")
}
```

---

## API Changes

### Modified Endpoints

| Endpoint | Change |
|---|---|
| `POST /api/sessions/:id/soap-note/submit-review` | **Replaced** — becomes "Assign for Review" (see new endpoint below) |
| `POST /api/sessions/:id/soap-note/approve` | **Modified** — can now be called by the assigned reviewer OR the owner (for self-approval from DRAFT) |

### New/Updated Endpoint Details

#### Assign for Review
`POST /api/sessions/:id/soap-note/assign-review`

Replaces the old `submit-review` endpoint.

**Request body:**
```json
{ "reviewerId": "physician-uuid" }
```

**Guards:**
- Authenticated, physician resolved
- Session exists, SOAP note exists
- Caller is the session owner (only the owner can assign a reviewer)
- Current workflowStatus is DRAFT
- `reviewerId` is a valid physician ID and is NOT the session owner (can't assign yourself)

**Actions (in a transaction):**
- Set `workflowStatus = PENDING_REVIEW`
- Set `assignedReviewerId = reviewerId`
- Clear `reviewFeedback = null` (in case this is a re-assignment after a return)
- Create `REVIEW_ASSIGNED` audit event with metadata: `{ assignedTo: reviewer.fullName }`

#### Approve & Sign
`POST /api/sessions/:id/soap-note/approve`

Updated to support two approval paths.

**Path 1 — Self-approval by owner:**
- Caller is the session owner
- Current workflowStatus is DRAFT (skips PENDING_REVIEW entirely)
- Same behavior as current: sets APPROVED, stamps approvedAt/approvedById, session → COMPLETED, writes NOTE_APPROVED audit event

**Path 2 — Reviewer approval:**
- Caller is the `assignedReviewerId` on the SOAP note
- Current workflowStatus is PENDING_REVIEW
- Sets APPROVED, stamps `approvedAt` and `approvedById` (the reviewer's ID, since they're the one signing)
- Sets session status → COMPLETED
- Writes `NOTE_APPROVED` audit event with metadata: `{ approvedBy: reviewer.fullName }`

**Rejects (403/400):**
- If caller is neither the owner (from DRAFT) nor the assigned reviewer (from PENDING_REVIEW)
- If workflowStatus doesn't match the caller's role

#### Return to Draft
`POST /api/sessions/:id/soap-note/return-to-draft`

New endpoint — only the assigned reviewer can return a note.

**Request body:**
```json
{ "feedback": "Please clarify the assessment — consider ruling out pneumonia." }
```

**Guards:**
- Authenticated, physician resolved
- Session exists, SOAP note exists
- Caller is the `assignedReviewerId`
- Current workflowStatus is PENDING_REVIEW

**Actions (in a transaction):**
- Set `workflowStatus = DRAFT`
- Set `reviewFeedback = feedback` (the feedback text)
- Keep `assignedReviewerId` intact (so the owner knows who returned it and can re-submit)
- Create `REVIEW_RETURNED` audit event with metadata: `{ returnedBy: reviewer.fullName, feedback: feedback }`

### Existing Endpoints — Minor Updates

| Endpoint | Change |
|---|---|
| `GET /api/sessions/:id` | SOAP note response now includes `assignedReviewer: { id, fullName }` and `reviewFeedback` |
| `GET /api/sessions` | When `scope=mine`, also return sessions where the current physician is the `assignedReviewerId` on a PENDING_REVIEW SOAP note (these are "assigned to you for review") |
| `GET /api/physicians` | Already exists — used to populate the reviewer selection dropdown |

---

## Frontend Changes

### SoapWorkflowActions — Updated Button Logic

| workflowStatus | Viewer is owner | Viewer is assigned reviewer | Viewer is neither |
|---|---|---|---|
| **DRAFT** | "Save Draft", "Sign & Finalize", "Assign for Review" | — | — |
| **DRAFT** (returned with feedback) | Same as above + feedback banner shown | — | — |
| **PENDING_REVIEW** | "Save Draft" (can still edit), info banner: "Assigned to Dr. X for review" | "Approve & Sign", "Return to Draft" | Read-only, info banner |
| **APPROVED** | Read-only, no buttons | Read-only, no buttons | Read-only, no buttons |

### New Components

**`AssignReviewDialog`**
- Modal/dialog triggered by "Assign for Review" button
- Contains a dropdown populated from `GET /api/physicians` (filtered to exclude the current physician — can't assign to yourself)
- "Assign" button calls `POST /api/sessions/:id/soap-note/assign-review`
- On success: toast "Assigned to Dr. X for review", refresh session state

**`ReviewFeedbackBanner`**
- Shown on the Active Visit page when the SOAP note has `reviewFeedback` and status is DRAFT
- Displays: "Dr. {reviewer name} returned this note for revision:" followed by the feedback text in a styled callout/quote block
- Dismissable or always-visible — but the feedback text should be prominent so the owner doesn't miss it

**`ReviewerActions`**
- Shown only when the viewer is the assigned reviewer and status is PENDING_REVIEW
- Two buttons: "Approve & Sign" (green, with confirmation dialog) and "Return to Draft" (secondary, opens a textarea for feedback)
- The "Return to Draft" button expands an inline textarea for feedback with a "Submit" button

### Dashboard Updates

Add a second section to the dashboard for review assignments:

```
── Your Active Sessions ──
[existing active session cards]

── Assigned to You for Review ──
┌───────────────────────────────────────────────────┐
│ Sarah Johnson  •  Apr 14, 2026                    │
│ Dr. James Lee's session  •  ● Pending Review      │
│ SOAP note waiting for your sign-off               │
└───────────────────────────────────────────────────┘
```

These are sessions owned by OTHER physicians where the current physician is the `assignedReviewerId` and the status is `PENDING_REVIEW`. Clicking navigates to the visit (which shows the reviewer actions).

Update the quick stats bar: add or modify to include "X awaiting your sign-off" count.

### Audit Trail Events

| Event | When | Metadata |
|---|---|---|
| `REVIEW_ASSIGNED` | Owner assigns a reviewer | `{ assignedTo: "Dr. Name" }` |
| `NOTE_APPROVED` | Reviewer or owner approves | `{ approvedBy: "Dr. Name" }` |
| `REVIEW_RETURNED` | Reviewer returns to draft | `{ returnedBy: "Dr. Name", feedback: "..." }` |

The existing `REVIEW_REQUESTED` event type is replaced by `REVIEW_ASSIGNED`.

---

## Removed

- `POST /api/sessions/:id/soap-note/submit-review` — replaced by `assign-review`
- The "Request Review" button — replaced by "Assign for Review" with physician selection
