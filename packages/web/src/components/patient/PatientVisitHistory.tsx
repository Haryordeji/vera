import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, ChevronRight, Loader2, Calendar } from "lucide-react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/visit/StatusBadge";
import type { PatientSummary, Session, WorkflowStatus } from "@/lib/types";

interface Props {
  patientId: string;
  visits: PatientSummary[];
}

function formatVisitDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const WORKFLOW_LABEL: Record<WorkflowStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
};

const WORKFLOW_STYLE: Record<WorkflowStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_REVIEW: "bg-orange-100 text-orange-700",
  APPROVED: "bg-green-100 text-green-700",
};

export function PatientVisitHistory({ patientId, visits }: Props) {
  const navigate = useNavigate();
  const { post } = useApi();
  const { showToast } = useToast();
  const [starting, setStarting] = useState(false);

  async function handleStartVisit() {
    setStarting(true);
    try {
      const session = await post<Session>("/sessions", { patientId });
      navigate(`/visits/${session.id}`);
    } catch {
      showToast("Failed to start visit", "error");
      setStarting(false);
    }
  }

  const sorted = [...visits].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );

  return (
    <section data-testid="patient-visit-history" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Visit History</h2>
        <button
          onClick={handleStartVisit}
          disabled={starting}
          data-testid="start-new-visit"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors"
        >
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Start New Visit
        </button>
      </div>

      {sorted.length === 0 ? (
        <div
          data-testid="patient-visit-history-empty"
          className="bg-white rounded-lg border border-slate-200 px-5 py-12 text-center"
        >
          <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-medium text-slate-700">
            No visits yet for this patient.
          </h3>
          <p className="text-xs text-slate-400 mt-1">Start the first one.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => navigate(`/visits/${v.id}`)}
                data-testid={`visit-row-${v.id}`}
                className="group w-full flex items-center gap-4 px-5 py-4 bg-white border border-slate-200 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatVisitDate(v.recordedAt)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dr. {v.physician.fullName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={v.status} />
                  {v.soapNote && (
                    <span
                      data-testid={`visit-soap-${v.id}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${WORKFLOW_STYLE[v.soapNote.workflowStatus]}`}
                    >
                      <FileText className="w-3 h-3" />
                      {WORKFLOW_LABEL[v.soapNote.workflowStatus]}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
