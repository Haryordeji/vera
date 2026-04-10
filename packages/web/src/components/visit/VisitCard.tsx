import { useNavigate } from "react-router-dom";
import { UserRound, ChevronRight } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { Session } from "@/lib/types";

interface VisitCardProps {
  session: Session;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function VisitCard({ session }: VisitCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/visits/${session.id}`)}
      className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-slate-200 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all text-left group"
      aria-label={`Open visit for ${session.patient?.fullName ?? "patient"}`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
        <UserRound className="w-4 h-4 text-slate-400" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {session.patient?.fullName ?? "Unknown Patient"}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatDate(session.recordedAt)}
        </p>
      </div>

      {/* Status + chevron */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status={session.status} />
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </button>
  );
}
