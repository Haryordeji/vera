import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { WorkflowStatus } from "@/lib/types";

interface Props {
  workflowStatus: WorkflowStatus;
  saving?: boolean;
  onSaveDraft: () => void;
  onRequestReview: () => void;
  onApprove: () => void;
}

export function SoapWorkflowActions({
  workflowStatus,
  saving = false,
  onSaveDraft,
  onRequestReview,
  onApprove,
}: Props) {
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  if (workflowStatus === "APPROVED") return null;

  return (
    <div
      className="flex items-center gap-3 pb-4"
      data-testid="soap-workflow-actions"
    >
      {/* Save Draft — available in DRAFT and PENDING_REVIEW */}
      <button
        onClick={onSaveDraft}
        disabled={saving}
        data-testid="btn-save-draft"
        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Draft"}
      </button>

      {/* Request Review — only in DRAFT */}
      {workflowStatus === "DRAFT" && (
        <>
          <button
            onClick={() => setReviewDialogOpen(true)}
            data-testid="btn-request-review"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Request Review
          </button>
          <ConfirmDialog
            open={reviewDialogOpen}
            title="Submit for Review"
            message="Submit this SOAP note for review? You can still edit it after submission."
            confirmLabel="Submit for Review"
            onConfirm={() => {
              setReviewDialogOpen(false);
              onRequestReview();
            }}
            onCancel={() => setReviewDialogOpen(false)}
          />
        </>
      )}

      {/* Sign & Finalize — only in PENDING_REVIEW */}
      {workflowStatus === "PENDING_REVIEW" && (
        <>
          <button
            onClick={() => setApproveDialogOpen(true)}
            data-testid="btn-sign-finalize"
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
          >
            Sign &amp; Finalize
          </button>
          <ConfirmDialog
            open={approveDialogOpen}
            title="Sign & Finalize Note"
            message="This action is irreversible. Once approved, the SOAP note cannot be edited. Are you sure you want to sign and finalize?"
            confirmLabel="Sign & Finalize"
            confirmClassName="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
            onConfirm={() => {
              setApproveDialogOpen(false);
              onApprove();
            }}
            onCancel={() => setApproveDialogOpen(false)}
          />
        </>
      )}
    </div>
  );
}
