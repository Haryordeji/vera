import { useNavigate } from "react-router-dom";
import { UserRound, ChevronRight } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { Session, SessionStatus } from "@/lib/types";

interface ActiveSessionCardProps {
  session: Session;
}

const ACTION_NEEDED: Record<Exclude<SessionStatus, "COMPLETED">, string> = {
  RECORDING: "Visit started, awaiting recording",
  TRANSCRIBING: "Audio uploaded, transcription in progress",
  GENERATING_NOTE: "Transcript ready, generating SOAP note",
  IN_REVIEW: "SOAP note draft ready for review",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ActiveSessionCard({ session }: ActiveSessionCardProps) {
  const navigate = useNavigate();
  const description =
    session.status !== "COMPLETED" ? ACTION_NEEDED[session.status] : "";

  return (
    <button
      data-testid="active-session-card"
      data-status={session.status}
      onClick={() => navigate(`/visits/${session.id}`)}
      className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-slate-200 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all text-left group"
      aria-label={`Open visit for ${session.patient?.fullName ?? "patient"}`}
    >
      <div className="flex-shrink-0 w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
        <UserRound className="w-4 h-4 text-slate-400" />
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
        <p className="text-xs text-slate-500 mt-1 truncate">{description}</p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status={session.status} />
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </button>
  );
}
