import { useEffect, useMemo, useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { SoapNote } from "@/lib/types";

interface PhysicianOption {
  id: string;
  fullName: string;
}

interface Props {
  open: boolean;
  sessionId: string;
  currentPhysicianId: string | null;
  onCancel: () => void;
  onAssigned: (note: SoapNote, reviewerName: string) => void;
}

const FORBIDDEN_TOAST = "You can only modify sessions you created.";
function isForbiddenError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("API 403");
}

export function AssignReviewDialog({
  open,
  sessionId,
  currentPhysicianId,
  onCancel,
  onAssigned,
}: Props) {
  const { get, post } = useApi();
  const { showToast } = useToast();
  const [physicians, setPhysicians] = useState<PhysicianOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingList(true);
    get<PhysicianOption[]>("/physicians")
      .then((list) => {
        if (cancelled) return;
        setPhysicians(list);
      })
      .catch(() => {
        if (cancelled) return;
        showToast("Failed to load physicians", "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, get, showToast]);

  const options = useMemo(
    () => physicians.filter((p) => p.id !== currentPhysicianId),
    [physicians, currentPhysicianId]
  );

  // Reset selection each time the dialog re-opens
  useEffect(() => {
    if (open) setSelectedId("");
  }, [open]);

  if (!open) return null;

  const handleAssign = async () => {
    if (!selectedId || submitting) return;
    const reviewer = options.find((p) => p.id === selectedId);
    if (!reviewer) return;

    setSubmitting(true);
    try {
      const updated = await post<SoapNote>(
        `/sessions/${sessionId}/soap-note/assign-review`,
        { reviewerId: selectedId }
      );
      showToast(`Assigned to ${reviewer.fullName} for review`);
      onAssigned(updated, reviewer.fullName);
    } catch (err) {
      showToast(
        isForbiddenError(err) ? FORBIDDEN_TOAST : "Failed to assign reviewer",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="assign-review-dialog"
    >
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="w-4 h-4 text-blue-600" />
          <h3 className="text-base font-semibold text-slate-900">
            Assign for Review
          </h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Select a colleague to review and sign off on this SOAP note.
        </p>

        <label
          htmlFor="assign-review-physician"
          className="block text-xs font-medium text-slate-500 mb-1.5"
        >
          Reviewer
        </label>
        {loadingList ? (
          <div
            className="flex items-center gap-2 text-sm text-slate-500 py-2"
            data-testid="assign-review-loading"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading physicians…
          </div>
        ) : options.length === 0 ? (
          <p
            className="text-sm text-slate-500 py-2"
            data-testid="assign-review-empty"
          >
            No other physicians available to assign.
          </p>
        ) : (
          <select
            id="assign-review-physician"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={submitting}
            data-testid="assign-review-select"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">Select a physician…</option>
            {options.map((p) => (
              <option key={p.id} value={p.id} data-testid={`assign-review-option-${p.id}`}>
                {p.fullName}
              </option>
            ))}
          </select>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={submitting}
            data-testid="assign-review-cancel"
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedId || submitting || loadingList}
            data-testid="assign-review-submit"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Assigning…" : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
