import { useState } from "react";
import {
  Users,
  Mic,
  FileText,
  Sparkles,
  PenLine,
  Send,
  CornerUpLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Per-event-type visual config
// ---------------------------------------------------------------------------
interface EventConfig {
  icon: React.ReactNode;
  iconBg: string;
  badge: string;
  badgeColor: string;
}

function getEventConfig(eventType: string): EventConfig {
  switch (eventType) {
    case "SESSION_CREATED":
      return {
        icon: <Users className="w-3 h-3" />,
        iconBg: "bg-slate-400",
        badge: "Created",
        badgeColor: "bg-slate-100 text-slate-600",
      };
    case "AUDIO_CAPTURED":
      return {
        icon: <Mic className="w-3 h-3" />,
        iconBg: "bg-blue-400",
        badge: "Audio",
        badgeColor: "bg-blue-100 text-blue-700",
      };
    case "TRANSCRIPT_GENERATED":
      return {
        icon: <FileText className="w-3 h-3" />,
        iconBg: "bg-purple-400",
        badge: "Transcript",
        badgeColor: "bg-purple-100 text-purple-700",
      };
    case "SOAP_DRAFT_CREATED":
      return {
        icon: <Sparkles className="w-3 h-3" />,
        iconBg: "bg-yellow-400",
        badge: "Draft",
        badgeColor: "bg-yellow-100 text-yellow-700",
      };
    case "SOAP_EDITED":
      return {
        icon: <PenLine className="w-3 h-3" />,
        iconBg: "bg-orange-400",
        badge: "Edited",
        badgeColor: "bg-orange-100 text-orange-700",
      };
    // REVIEW_REQUESTED is the legacy event type from before the assign-review
    // workflow — keep it rendering gracefully for historical audit trails by
    // aliasing it onto the same visual treatment as REVIEW_ASSIGNED.
    case "REVIEW_REQUESTED":
    case "REVIEW_ASSIGNED":
      return {
        icon: <Send className="w-3 h-3" />,
        iconBg: "bg-sky-500",
        badge: "Assigned",
        badgeColor: "bg-sky-100 text-sky-700",
      };
    case "REVIEW_RETURNED":
      return {
        icon: <CornerUpLeft className="w-3 h-3" />,
        iconBg: "bg-amber-500",
        badge: "Returned",
        badgeColor: "bg-amber-100 text-amber-700",
      };
    case "NOTE_APPROVED":
      return {
        icon: <CheckCircle2 className="w-3 h-3" />,
        iconBg: "bg-emerald-500",
        badge: "Signed",
        badgeColor: "bg-emerald-100 text-emerald-700",
      };
    default:
      return {
        icon: <History className="w-3 h-3" />,
        iconBg: "bg-slate-300",
        badge: "Event",
        badgeColor: "bg-slate-100 text-slate-500",
      };
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// AuditTimeline component
// ---------------------------------------------------------------------------
interface Props {
  events: AuditEvent[];
}

export function AuditTimeline({ events }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (events.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-32 text-center"
        data-testid="audit-empty"
      >
        <History className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-400">
          Events will appear here as the visit progresses.
        </p>
      </div>
    );
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div data-testid="audit-timeline" className="relative">
      {/* Vertical connecting line */}
      {events.length > 1 && (
        <div className="absolute left-[13px] top-6 bottom-6 w-px bg-slate-200" />
      )}

      <div className="space-y-5">
        {events.map((event, i) => {
          const config = getEventConfig(event.eventType);
          const hasMetadata =
            event.metadata !== null &&
            typeof event.metadata === "object" &&
            Object.keys(event.metadata).length > 0;
          const isExpanded = expandedIds.has(event.id);

          return (
            <div
              key={event.id}
              data-testid={`audit-event-${i}`}
              className="relative flex gap-3"
            >
              {/* Icon circle */}
              <div
                data-testid={`audit-event-icon-${event.eventType}`}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-white",
                  config.iconBg
                )}
              >
                {config.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800 leading-tight">
                    {event.description ?? event.eventType}
                  </p>
                  <span
                    data-testid={`audit-event-badge-${event.eventType}`}
                    className={cn(
                      "shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
                      config.badgeColor
                    )}
                  >
                    {config.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-0.5">
                  {formatTime(event.createdAt)}{" "}
                  <span className="text-slate-300">·</span>{" "}
                  {event.author}
                </p>

                {/* REVIEW_RETURNED — surface the reviewer's feedback inline */}
                {event.eventType === "REVIEW_RETURNED" &&
                  typeof (event.metadata as { feedback?: unknown } | null)
                    ?.feedback === "string" &&
                  (event.metadata as { feedback: string }).feedback.trim() && (
                    <blockquote
                      data-testid={`audit-event-feedback-${i}`}
                      className="mt-2 border-l-2 border-amber-300 pl-2.5 text-xs italic text-amber-900 whitespace-pre-wrap"
                    >
                      {(event.metadata as { feedback: string }).feedback}
                    </blockquote>
                  )}

                {/* Metadata toggle */}
                {hasMetadata && (
                  <div className="mt-1.5">
                    <button
                      onClick={() => toggleExpanded(event.id)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                      data-testid={`audit-event-details-toggle-${i}`}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      {isExpanded ? "Hide details" : "Show details"}
                    </button>
                    {isExpanded && (
                      <div
                        className="mt-1 text-xs text-slate-500 bg-slate-100 rounded p-2 font-mono"
                        data-testid={`audit-event-metadata-${i}`}
                      >
                        {(event.metadata as { changedFields?: string[] })
                          .changedFields?.length ? (
                          <span>
                            Fields changed:{" "}
                            {(
                              event.metadata as { changedFields: string[] }
                            ).changedFields.join(", ")}
                          </span>
                        ) : (
                          <span>{JSON.stringify(event.metadata)}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p
        className="mt-5 text-xs text-slate-400 text-center"
        data-testid="audit-view-history"
      >
        {events.length} event{events.length !== 1 ? "s" : ""} total
      </p>
    </div>
  );
}
