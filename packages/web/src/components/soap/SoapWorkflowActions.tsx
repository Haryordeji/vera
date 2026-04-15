import { useState } from "react";
import { UserCheck, CornerUpLeft } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { WorkflowStatus } from "@/lib/types";

interface Props {
  workflowStatus: WorkflowStatus;
  isOwner: boolean;
  isAssignedReviewer: boolean;
  assignedReviewerName?: string | null;
  saving?: boolean;
  returning?: boolean;
  onSaveDraft?: () => void;
  onApprove?: () => void;
  onAssignForReview?: () => void;
  onReturnToDraft?: (feedback: string) => void;
}

export function SoapWorkflowActions({
  workflowStatus,
  isOwner,
  isAssignedReviewer,
  assignedReviewerName,
  saving = false,
  returning = false,
  onSaveDraft,
  onApprove,
  onAssignForReview,
  onReturnToDraft,
}: Props) {
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [reviewerApproveDialogOpen, setReviewerApproveDialogOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState("");

  // Nothing to show for approved notes or for users who are neither role.
  if (workflowStatus === "APPROVED") return null;
  if (!isOwner && !isAssignedReviewer) return null;

  // ------------------------------------------------------------------
  // Owner view
  // ------------------------------------------------------------------
  if (isOwner) {
    return (
      <div
        className="flex flex-col gap-3 pb-4"
        data-testid="soap-workflow-actions"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {/* Save Draft — available in DRAFT and PENDING_REVIEW */}
          <button
            onClick={onSaveDraft}
            disabled={saving}
            data-testid="btn-save-draft"
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>

          {workflowStatus === "DRAFT" && (
            <>
              {/* Sign & Finalize (self-approve from DRAFT) */}
              <button
                onClick={() => setApproveDialogOpen(true)}
                data-testid="btn-sign-finalize"
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
              >
                Sign &amp; Finalize
              </button>

              {/* Assign for Review (opens dialog) */}
              <button
                onClick={onAssignForReview}
                data-testid="btn-assign-review"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <UserCheck className="w-4 h-4" />
                Assign for Review
              </button>
            </>
          )}
        </div>

        {/* Info line when waiting on a reviewer */}
        {workflowStatus === "PENDING_REVIEW" && (
          <p
            data-testid="pending-review-info"
            className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-2"
          >
            Assigned to{" "}
            <span className="font-medium text-slate-800">
              {assignedReviewerName ?? "another physician"}
            </span>{" "}
            for review. You can still edit the note while you wait.
          </p>
        )}

        <ConfirmDialog
          open={approveDialogOpen}
          title="Sign & Finalize Note"
          message="This action is irreversible. Once approved, the SOAP note cannot be edited. Are you sure you want to sign and finalize?"
          confirmLabel="Sign & Finalize"
          confirmClassName="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
          onConfirm={() => {
            setApproveDialogOpen(false);
            onApprove?.();
          }}
          onCancel={() => setApproveDialogOpen(false)}
        />
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Reviewer view (isAssignedReviewer && !isOwner)
  // ------------------------------------------------------------------
  if (workflowStatus !== "PENDING_REVIEW") {
    // Reviewer can only act while the note is PENDING_REVIEW — graceful fallback.
    return null;
  }

  const handleSubmitReturn = () => {
    onReturnToDraft?.(feedbackDraft);
    setReturnOpen(false);
    setFeedbackDraft("");
  };

  return (
    <div
      className="flex flex-col gap-3 pb-4"
      data-testid="soap-workflow-actions"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setReviewerApproveDialogOpen(true)}
          data-testid="btn-reviewer-approve"
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
        >
          Approve &amp; Sign
        </button>
        <button
          onClick={() => setReturnOpen((v) => !v)}
          data-testid="btn-return-to-draft"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
        >
          <CornerUpLeft className="w-4 h-4" />
          Return to Draft
        </button>
      </div>

      {returnOpen && (
        <div
          className="border border-slate-200 rounded-md p-3 bg-slate-50"
          data-testid="return-to-draft-panel"
        >
          <label
            htmlFor="return-feedback"
            className="block text-xs font-medium text-slate-500 mb-1.5"
          >
            Feedback for the author
          </label>
          <textarea
            id="return-feedback"
            value={feedbackDraft}
            onChange={(e) => setFeedbackDraft(e.target.value)}
            placeholder="Optional: explain what needs to be revised..."
            rows={3}
            data-testid="return-to-draft-textarea"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setReturnOpen(false);
                setFeedbackDraft("");
              }}
              disabled={returning}
              data-testid="return-to-draft-cancel"
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitReturn}
              disabled={returning}
              data-testid="return-to-draft-submit"
              className="px-3 py-1.5 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {returning ? "Returning…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={reviewerApproveDialogOpen}
        title="Approve & Sign Note"
        message="This will finalize the note. This action is irreversible."
        confirmLabel="Approve & Sign"
        confirmClassName="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
        onConfirm={() => {
          setReviewerApproveDialogOpen(false);
          onApprove?.();
        }}
        onCancel={() => setReviewerApproveDialogOpen(false)}
      />
    </div>
  );
}
