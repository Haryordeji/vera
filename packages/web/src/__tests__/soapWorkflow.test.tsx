import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SoapContent } from "../components/soap/SoapNoteEditor";

// ---------------------------------------------------------------------------
// Hoisted API mocks (used by AssignReviewDialog)
// ---------------------------------------------------------------------------
const { mockGet, mockPost, mockPut, mockDel, mockUploadFile } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDel: vi.fn(),
  mockUploadFile: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  useApi: () => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    del: mockDel,
    uploadFile: mockUploadFile,
  }),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));

import { SoapWorkflowActions } from "../components/soap/SoapWorkflowActions";
import { SoapNoteEditor } from "../components/soap/SoapNoteEditor";
import { AssignReviewDialog } from "../components/soap/AssignReviewDialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ToastProvider } from "../components/ui/Toast";

const MOCK_NOTE: SoapContent = {
  subjective: "Patient reports cough.",
  objective: "No objective findings.",
  assessment: "Upper respiratory infection.",
  plan: "Rest and fluids.",
};

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDel.mockReset();
  mockUploadFile.mockReset();
});

// ---------------------------------------------------------------------------
// SoapWorkflowActions — owner view
// ---------------------------------------------------------------------------
describe("SoapWorkflowActions — owner in DRAFT", () => {
  it("renders Save Draft, Sign & Finalize, and Assign for Review", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        isOwner={true}
        isAssignedReviewer={false}
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    expect(screen.getByTestId("btn-save-draft")).toBeInTheDocument();
    expect(screen.getByTestId("btn-sign-finalize")).toBeInTheDocument();
    expect(screen.getByTestId("btn-assign-review")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-reviewer-approve")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-return-to-draft")).not.toBeInTheDocument();
  });

  it("clicking Sign & Finalize shows the irreversible confirmation dialog", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        isOwner={true}
        isAssignedReviewer={false}
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-sign-finalize"));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
  });

  it("clicking Sign & Finalize → Confirm invokes onApprove", () => {
    const onApprove = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        isOwner={true}
        isAssignedReviewer={false}
        onSaveDraft={vi.fn()}
        onApprove={onApprove}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-sign-finalize"));
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("clicking Assign for Review invokes onAssignForReview", () => {
    const onAssignForReview = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        isOwner={true}
        isAssignedReviewer={false}
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={onAssignForReview}
        onReturnToDraft={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-assign-review"));
    expect(onAssignForReview).toHaveBeenCalledOnce();
  });
});

describe("SoapWorkflowActions — owner in PENDING_REVIEW", () => {
  it("renders only Save Draft and an info line with the assigned reviewer's name", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="PENDING_REVIEW"
        isOwner={true}
        isAssignedReviewer={false}
        assignedReviewerName="Dr. Reviewer Jane"
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    expect(screen.getByTestId("btn-save-draft")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-sign-finalize")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-assign-review")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-reviewer-approve")).not.toBeInTheDocument();

    const info = screen.getByTestId("pending-review-info");
    expect(info).toHaveTextContent("Dr. Reviewer Jane");
    expect(info).toHaveTextContent(/assigned to/i);
  });
});

describe("SoapWorkflowActions — APPROVED", () => {
  it("renders nothing when status is APPROVED, regardless of role", () => {
    const { container } = render(
      <SoapWorkflowActions
        workflowStatus="APPROVED"
        isOwner={true}
        isAssignedReviewer={false}
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SoapWorkflowActions — reviewer view
// ---------------------------------------------------------------------------
describe("SoapWorkflowActions — reviewer in PENDING_REVIEW", () => {
  it("renders Approve & Sign and Return to Draft buttons (no Save Draft)", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="PENDING_REVIEW"
        isOwner={false}
        isAssignedReviewer={true}
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    expect(screen.getByTestId("btn-reviewer-approve")).toBeInTheDocument();
    expect(screen.getByTestId("btn-return-to-draft")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-save-draft")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-sign-finalize")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-assign-review")).not.toBeInTheDocument();
  });

  it("clicking Approve & Sign shows the irreversible confirm dialog, then calls onApprove", () => {
    const onApprove = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="PENDING_REVIEW"
        isOwner={false}
        isAssignedReviewer={true}
        onSaveDraft={vi.fn()}
        onApprove={onApprove}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-reviewer-approve"));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("clicking Return to Draft reveals the inline feedback panel, Submit forwards the text", () => {
    const onReturnToDraft = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="PENDING_REVIEW"
        isOwner={false}
        isAssignedReviewer={true}
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={onReturnToDraft}
      />
    );
    // Panel is hidden by default
    expect(screen.queryByTestId("return-to-draft-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-return-to-draft"));
    expect(screen.getByTestId("return-to-draft-panel")).toBeInTheDocument();

    const textarea = screen.getByTestId("return-to-draft-textarea");
    fireEvent.change(textarea, {
      target: { value: "Please clarify the assessment section." },
    });
    fireEvent.click(screen.getByTestId("return-to-draft-submit"));

    expect(onReturnToDraft).toHaveBeenCalledWith(
      "Please clarify the assessment section."
    );
  });

  it("Submit forwards an empty string when no feedback is typed", () => {
    const onReturnToDraft = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="PENDING_REVIEW"
        isOwner={false}
        isAssignedReviewer={true}
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={onReturnToDraft}
      />
    );
    fireEvent.click(screen.getByTestId("btn-return-to-draft"));
    fireEvent.click(screen.getByTestId("return-to-draft-submit"));
    expect(onReturnToDraft).toHaveBeenCalledWith("");
  });
});

describe("SoapWorkflowActions — reviewer outside PENDING_REVIEW", () => {
  it("renders nothing when a reviewer looks at a DRAFT", () => {
    const { container } = render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        isOwner={false}
        isAssignedReviewer={true}
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SoapWorkflowActions — neither owner nor reviewer
// ---------------------------------------------------------------------------
describe("SoapWorkflowActions — uninvolved physician", () => {
  it.each(["DRAFT", "PENDING_REVIEW", "APPROVED"] as const)(
    "renders no action buttons in %s status",
    (status) => {
      const { container } = render(
        <SoapWorkflowActions
          workflowStatus={status}
          isOwner={false}
          isAssignedReviewer={false}
          onSaveDraft={vi.fn()}
          onApprove={vi.fn()}
          onAssignForReview={vi.fn()}
          onReturnToDraft={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    }
  );
});

// ---------------------------------------------------------------------------
// SoapWorkflowActions — Save Draft basics
// ---------------------------------------------------------------------------
describe("SoapWorkflowActions — Save Draft", () => {
  it("calls onSaveDraft when Save Draft is clicked (owner DRAFT)", () => {
    const onSaveDraft = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        isOwner={true}
        isAssignedReviewer={false}
        onSaveDraft={onSaveDraft}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-save-draft"));
    expect(onSaveDraft).toHaveBeenCalledOnce();
  });

  it("shows 'Saving…' and disables the button when saving is true", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        isOwner={true}
        isAssignedReviewer={false}
        saving={true}
        onSaveDraft={vi.fn()}
        onApprove={vi.fn()}
        onAssignForReview={vi.fn()}
        onReturnToDraft={vi.fn()}
      />
    );
    const btn = screen.getByTestId("btn-save-draft");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Saving…");
  });
});

// ---------------------------------------------------------------------------
// AssignReviewDialog — physician list + assign flow
// ---------------------------------------------------------------------------
describe("AssignReviewDialog", () => {
  const physicianList = [
    { id: "phys-1", fullName: "Dr. Alice Chen" },
    { id: "phys-2", fullName: "Dr. Bob Reyes" },
    { id: "phys-3", fullName: "Dr. Carol Singh" },
  ];

  it("renders the physician list excluding the current user", async () => {
    mockGet.mockResolvedValue(physicianList);
    renderWithToast(
      <AssignReviewDialog
        open={true}
        sessionId="sess-1"
        currentPhysicianId="phys-2"
        onCancel={vi.fn()}
        onAssigned={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("assign-review-select")).toBeInTheDocument();
    });

    expect(mockGet).toHaveBeenCalledWith("/physicians");
    expect(screen.getByTestId("assign-review-option-phys-1")).toBeInTheDocument();
    expect(screen.getByTestId("assign-review-option-phys-3")).toBeInTheDocument();
    // Current user (phys-2) is excluded
    expect(
      screen.queryByTestId("assign-review-option-phys-2")
    ).not.toBeInTheDocument();
  });

  it("Assign button is disabled until a physician is picked, then POSTs and calls onAssigned", async () => {
    mockGet.mockResolvedValue(physicianList);
    const fakeNote = {
      id: "note-1",
      sessionId: "sess-1",
      workflowStatus: "PENDING_REVIEW" as const,
      assignedReviewerId: "phys-3",
      assignedReviewer: { id: "phys-3", fullName: "Dr. Carol Singh" },
    };
    mockPost.mockResolvedValue(fakeNote);

    const onAssigned = vi.fn();
    renderWithToast(
      <AssignReviewDialog
        open={true}
        sessionId="sess-1"
        currentPhysicianId="phys-2"
        onCancel={vi.fn()}
        onAssigned={onAssigned}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("assign-review-select")).toBeInTheDocument();
    });

    const submit = screen.getByTestId("assign-review-submit");
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByTestId("assign-review-select"), {
      target: { value: "phys-3" },
    });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/sessions/sess-1/soap-note/assign-review",
        { reviewerId: "phys-3" }
      );
    });
    await waitFor(() => {
      expect(onAssigned).toHaveBeenCalledWith(fakeNote, "Dr. Carol Singh");
    });
  });

  it("renders nothing when open is false and does not fetch physicians", () => {
    renderWithToast(
      <AssignReviewDialog
        open={false}
        sessionId="sess-1"
        currentPhysicianId="phys-2"
        onCancel={vi.fn()}
        onAssigned={vi.fn()}
      />
    );
    expect(screen.queryByTestId("assign-review-dialog")).not.toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SoapNoteEditor — read-only mode (unchanged)
// ---------------------------------------------------------------------------
describe("SoapNoteEditor — readOnly mode", () => {
  it("textareas have readOnly attribute when readOnly is true", () => {
    render(<SoapNoteEditor note={MOCK_NOTE} readOnly={true} />);
    expect(screen.getByTestId("soap-textarea-subjective")).toHaveAttribute("readonly");
    expect(screen.getByTestId("soap-textarea-objective")).toHaveAttribute("readonly");
    expect(screen.getByTestId("soap-textarea-assessment")).toHaveAttribute("readonly");
    expect(screen.getByTestId("soap-textarea-plan")).toHaveAttribute("readonly");
  });

  it("does NOT call onChange when readOnly textarea is changed", () => {
    const onChange = vi.fn();
    render(<SoapNoteEditor note={MOCK_NOTE} readOnly={true} onChange={onChange} />);
    const textarea = screen.getByTestId("soap-textarea-subjective");
    fireEvent.change(textarea, { target: { value: "Hacked value" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("textareas are editable when readOnly is false", () => {
    render(<SoapNoteEditor note={MOCK_NOTE} readOnly={false} />);
    const textarea = screen.getByTestId("soap-textarea-subjective");
    expect(textarea).not.toHaveAttribute("readonly");
  });
});

// ---------------------------------------------------------------------------
// ConfirmDialog (unchanged)
// ---------------------------------------------------------------------------
describe("ConfirmDialog", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Test"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog content when open is true", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Item"
        message="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Item")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });
});
