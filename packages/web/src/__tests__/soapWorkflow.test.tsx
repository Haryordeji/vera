import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SoapWorkflowActions } from "../components/soap/SoapWorkflowActions";
import { SoapNoteEditor } from "../components/soap/SoapNoteEditor";
import type { SoapContent } from "../components/soap/SoapNoteEditor";
import { ToastProvider } from "../components/ui/Toast";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

const MOCK_NOTE: SoapContent = {
  subjective: "Patient reports cough.",
  objective: "No objective findings.",
  assessment: "Upper respiratory infection.",
  plan: "Rest and fluids.",
};

// ---------------------------------------------------------------------------
// SoapWorkflowActions — button rendering by workflow status
// ---------------------------------------------------------------------------
describe("SoapWorkflowActions — DRAFT", () => {
  it("shows Save Draft and Request Review buttons", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        onSaveDraft={vi.fn()}
        onRequestReview={vi.fn()}
        onApprove={vi.fn()}
      />
    );
    expect(screen.getByTestId("btn-save-draft")).toBeInTheDocument();
    expect(screen.getByTestId("btn-request-review")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-sign-finalize")).not.toBeInTheDocument();
  });
});

describe("SoapWorkflowActions — PENDING_REVIEW", () => {
  it("shows Save Draft and Sign & Finalize buttons", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="PENDING_REVIEW"
        onSaveDraft={vi.fn()}
        onRequestReview={vi.fn()}
        onApprove={vi.fn()}
      />
    );
    expect(screen.getByTestId("btn-save-draft")).toBeInTheDocument();
    expect(screen.getByTestId("btn-sign-finalize")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-request-review")).not.toBeInTheDocument();
  });
});

describe("SoapWorkflowActions — APPROVED", () => {
  it("renders nothing when status is APPROVED", () => {
    const { container } = render(
      <SoapWorkflowActions
        workflowStatus="APPROVED"
        onSaveDraft={vi.fn()}
        onRequestReview={vi.fn()}
        onApprove={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SoapWorkflowActions — confirm dialog interactions
// ---------------------------------------------------------------------------
describe("SoapWorkflowActions — Request Review dialog", () => {
  it("shows confirmation dialog when Request Review is clicked", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        onSaveDraft={vi.fn()}
        onRequestReview={vi.fn()}
        onApprove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-request-review"));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Submit for Review")).toBeInTheDocument();
  });

  it("calls onRequestReview when confirm is clicked", () => {
    const onRequestReview = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        onSaveDraft={vi.fn()}
        onRequestReview={onRequestReview}
        onApprove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-request-review"));
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(onRequestReview).toHaveBeenCalledOnce();
  });

  it("does NOT call onRequestReview when cancel is clicked", () => {
    const onRequestReview = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        onSaveDraft={vi.fn()}
        onRequestReview={onRequestReview}
        onApprove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-request-review"));
    fireEvent.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onRequestReview).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
  });
});

describe("SoapWorkflowActions — Sign & Finalize dialog", () => {
  it("shows irreversible warning dialog when Sign & Finalize is clicked", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="PENDING_REVIEW"
        onSaveDraft={vi.fn()}
        onRequestReview={vi.fn()}
        onApprove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-sign-finalize"));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
  });

  it("calls onApprove when confirm is clicked", () => {
    const onApprove = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="PENDING_REVIEW"
        onSaveDraft={vi.fn()}
        onRequestReview={vi.fn()}
        onApprove={onApprove}
      />
    );
    fireEvent.click(screen.getByTestId("btn-sign-finalize"));
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    expect(onApprove).toHaveBeenCalledOnce();
  });
});

describe("SoapWorkflowActions — Save Draft", () => {
  it("calls onSaveDraft when Save Draft is clicked", () => {
    const onSaveDraft = vi.fn();
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        onSaveDraft={onSaveDraft}
        onRequestReview={vi.fn()}
        onApprove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("btn-save-draft"));
    expect(onSaveDraft).toHaveBeenCalledOnce();
  });

  it("shows 'Saving…' and disables button when saving prop is true", () => {
    render(
      <SoapWorkflowActions
        workflowStatus="DRAFT"
        saving={true}
        onSaveDraft={vi.fn()}
        onRequestReview={vi.fn()}
        onApprove={vi.fn()}
      />
    );
    const btn = screen.getByTestId("btn-save-draft");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Saving…");
  });
});

// ---------------------------------------------------------------------------
// SoapNoteEditor — read-only mode
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
// ConfirmDialog
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
