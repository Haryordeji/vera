import { useNavigate } from "react-router-dom";
import { UserCheck, ChevronRight } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { Session } from "@/lib/types";

interface Props {
  session: Session;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ReviewAssignmentCard({ session }: Props) {
  const navigate = useNavigate();
  const ownerName = session.physician?.fullName ?? "another physician";

  return (
    <button
      data-testid="review-assignment-card"
      data-session-id={session.id}
      onClick={() => navigate(`/visits/${session.id}`)}
      className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-slate-200 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all text-left group"
      aria-label={`Review ${session.patient?.fullName ?? "patient"}'s SOAP note`}
    >
      <div className="flex-shrink-0 w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center">
        <UserCheck className="w-4 h-4 text-blue-500" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {session.patient?.fullName ?? "Unknown Patient"}
          </p>
          <span className="text-slate-300 text-xs">·</span>
          <p className="text-xs text-slate-500 shrink-0">
            {formatDate(session.recordedAt)}
          </p>
        </div>
        <p
          className="text-xs text-slate-500 mt-1 truncate"
          data-testid="review-assignment-card-meta"
        >
          <span className="font-medium text-slate-600">Dr. {ownerName}</span>
          {"'s session · SOAP note waiting for your sign-off"}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status="IN_REVIEW" />
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </button>
  );
}
