import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; className: string }
> = {
  RECORDING: {
    label: "Recording",
    className: "bg-blue-100 text-blue-700",
  },
  TRANSCRIBING: {
    label: "Transcribing",
    className: "bg-amber-100 text-amber-700",
  },
  GENERATING_NOTE: {
    label: "Generating Note",
    className: "bg-purple-100 text-purple-700",
  },
  IN_REVIEW: {
    label: "In Review",
    className: "bg-orange-100 text-orange-700",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-green-100 text-green-700",
  },
};

interface StatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      data-testid="status-badge"
      data-status={status}
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
