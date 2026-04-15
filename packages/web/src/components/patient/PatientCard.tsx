import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserRound,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  Loader2,
} from "lucide-react";
import type { Patient } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PatientCardProps {
  patient: Patient;
  /** Called after a successful unarchive. Parent should update local state or refetch. */
  onUnarchive?: (patient: Patient) => void;
  /** Async unarchive action. When supplied alongside an archived patient, a button is rendered. */
  unarchivePatient?: (id: string) => Promise<Patient>;
}

function formatDob(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PatientCard({
  patient,
  onUnarchive,
  unarchivePatient,
}: PatientCardProps) {
  const navigate = useNavigate();
  const [unarchiving, setUnarchiving] = useState(false);

  const isArchived = !!patient.archivedAt;
  const visitCount = patient._count?.sessions ?? 0;

  const openDetail = () => navigate(`/patients/${patient.id}`);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  };

  const handleUnarchive = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!unarchivePatient) return;
    setUnarchiving(true);
    try {
      const updated = await unarchivePatient(patient.id);
      onUnarchive?.(updated);
    } finally {
      setUnarchiving(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={handleKeyDown}
      data-testid="patient-card"
      data-archived={isArchived ? "true" : "false"}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-4 border rounded-lg transition-all text-left group cursor-pointer outline-none focus:ring-2 focus:ring-blue-400",
        isArchived
          ? "bg-slate-50 border-slate-200 opacity-75 hover:opacity-95"
          : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm"
      )}
      aria-label={`Open patient ${patient.fullName}`}
    >
      <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
        <UserRound className="w-5 h-5 text-slate-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm font-semibold truncate",
              isArchived ? "text-slate-500" : "text-slate-900"
            )}
          >
            {patient.fullName}
          </p>
          {isArchived && (
            <span
              data-testid="patient-card-archived-badge"
              className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-200 text-slate-600"
            >
              Archived
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
          {patient.mrn && <span>MRN: {patient.mrn}</span>}
          {patient.mrn && patient.dateOfBirth && <span className="text-slate-300">•</span>}
          {patient.dateOfBirth && <span>{`DOB: ${formatDob(patient.dateOfBirth)}`}</span>}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 text-xs">
        <div className="flex items-center gap-1 text-slate-500">
          <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
          <span>{`${visitCount} ${visitCount === 1 ? "visit" : "visits"}`}</span>
        </div>
        {isArchived && unarchivePatient ? (
          <button
            type="button"
            onClick={handleUnarchive}
            disabled={unarchiving}
            data-testid="patient-card-unarchive"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
            aria-label={`Unarchive patient ${patient.fullName}`}
          >
            {unarchiving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            {unarchiving ? "Restoring…" : "Unarchive"}
          </button>
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
        )}
      </div>
    </div>
  );
}
