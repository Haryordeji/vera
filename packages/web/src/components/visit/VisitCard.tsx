import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound, ChevronRight, RotateCcw, Loader2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VisitCardProps {
  session: Session;
  /** When true, the current physician owns this session — show the unarchive button for archived sessions. */
  canUnarchive?: boolean;
  /** Async unarchive action. */
  unarchiveSession?: (id: string) => Promise<Session>;
  onUnarchive?: (session: Session) => void;
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

export function VisitCard({
  session,
  canUnarchive,
  unarchiveSession,
  onUnarchive,
}: VisitCardProps) {
  const navigate = useNavigate();
  const [unarchiving, setUnarchiving] = useState(false);

  const isArchived = !!session.archivedAt;
  const openDetail = () => navigate(`/visits/${session.id}`);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  };

  const handleUnarchive = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!unarchiveSession) return;
    setUnarchiving(true);
    try {
      const updated = await unarchiveSession(session.id);
      onUnarchive?.(updated);
    } finally {
      setUnarchiving(false);
    }
  };

  const showUnarchiveButton = isArchived && canUnarchive && !!unarchiveSession;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={handleKeyDown}
      data-testid="visit-card"
      data-archived={isArchived ? "true" : "false"}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-4 border rounded-lg transition-all text-left group cursor-pointer outline-none focus:ring-2 focus:ring-blue-400",
        isArchived
          ? "bg-slate-50 border-slate-200 opacity-75 hover:opacity-95"
          : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm"
      )}
      aria-label={`Open visit for ${session.patient?.fullName ?? "patient"}`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
        <UserRound className="w-4 h-4 text-slate-400" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm font-semibold truncate",
              isArchived ? "text-slate-500" : "text-slate-800"
            )}
          >
            {session.patient?.fullName ?? "Unknown Patient"}
          </p>
          {isArchived && (
            <span
              data-testid="visit-card-archived-badge"
              className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-200 text-slate-600"
            >
              Archived
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {session.physician?.fullName && (
            <span data-testid="visit-card-physician">Dr. {session.physician.fullName}</span>
          )}
          {session.physician?.fullName && <span className="text-slate-300 mx-1.5">·</span>}
          <span>{formatDate(session.recordedAt)}</span>
        </p>
      </div>

      {/* Status + action */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status={session.status} />
        {showUnarchiveButton ? (
          <button
            type="button"
            onClick={handleUnarchive}
            disabled={unarchiving}
            data-testid="visit-card-unarchive"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
            aria-label={`Unarchive visit for ${session.patient?.fullName ?? "patient"}`}
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
