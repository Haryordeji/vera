import { useNavigate } from "react-router-dom";
import { UserRound, ChevronRight, AlertTriangle, ClipboardList } from "lucide-react";
import type { Patient } from "@/lib/types";

interface PatientCardProps {
  patient: Patient;
}

function formatDob(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PatientCard({ patient }: PatientCardProps) {
  const navigate = useNavigate();

  const visitCount = patient._count?.sessions ?? 0;
  const allergyCount = patient._count?.allergies ?? 0;

  return (
    <button
      onClick={() => navigate(`/patients/${patient.id}`)}
      data-testid="patient-card"
      className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-slate-200 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all text-left group"
      aria-label={`Open patient ${patient.fullName}`}
    >
      <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
        <UserRound className="w-5 h-5 text-slate-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {patient.fullName}
        </p>
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
        <div
          className={
            allergyCount > 0
              ? "flex items-center gap-1 text-amber-700"
              : "flex items-center gap-1 text-slate-400"
          }
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{`${allergyCount} ${allergyCount === 1 ? "allergy" : "allergies"}`}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </button>
  );
}
