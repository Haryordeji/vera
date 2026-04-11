import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/visit/StatusBadge";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { useApi } from "@/lib/api";
import type { Session, AuditEvent } from "@/lib/types";
import { FileText, ClipboardList, Loader2 } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditTimeline({ events }: { events: AuditEvent[] }) {
  const dotColor: Record<string, string> = {
    SESSION_CREATED: "bg-blue-400",
    AUDIO_CAPTURED: "bg-green-400",
    TRANSCRIPT_GENERATED: "bg-purple-400",
    SOAP_DRAFT_CREATED: "bg-yellow-400",
    SOAP_EDITED: "bg-orange-400",
    NOTE_APPROVED: "bg-emerald-500",
  };

  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">No events yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-3">
          <div
            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor[e.eventType] ?? "bg-slate-300"}`}
          />
          <div>
            <p className="text-sm text-slate-700 font-medium">
              {e.description ?? e.eventType}
            </p>
            <p className="text-xs text-slate-400">
              {new Date(e.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ActiveVisitPage() {
  const { id } = useParams<{ id: string }>();
  const { get } = useApi();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    if (!id) return;
    try {
      const s = await get<Session>(`/sessions/${id}`);
      setSession(s);
    } catch {
      // session not found or error — leave null
    } finally {
      setLoading(false);
    }
  }, [get, id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const auditEvents: AuditEvent[] = session?.auditEvents ?? [];

  const rightPanel = (
    <div className="space-y-4">
      <AuditTimeline events={auditEvents} />
    </div>
  );

  if (loading) {
    return (
      <AppLayout title="Active Visit" rightPanel={rightPanel}>
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Active Visit" rightPanel={rightPanel}>
      <div className="px-6 py-6 space-y-6 max-w-3xl mx-auto">
        {/* Visit header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {session?.patient?.fullName ?? "Unknown Patient"}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {session ? formatDate(session.recordedAt) : "—"}
            </p>
          </div>
          {session && <StatusBadge status={session.status} />}
        </div>

        {/* Audio recorder panel */}
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 text-slate-500 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-700">
              Audio Recording
            </h3>
          </div>
          {id ? (
            <AudioRecorder
              sessionId={id}
              onUploadComplete={(updated) => setSession(updated)}
            />
          ) : (
            <p className="text-sm text-slate-400">No session ID.</p>
          )}
        </section>

        {/* Transcript panel */}
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              Transcript
            </h3>
          </div>
          <div className="flex items-center justify-center h-28 bg-slate-50 rounded-md border border-dashed border-slate-200">
            <p className="text-sm text-slate-400">
              Transcript will appear here after recording.
            </p>
          </div>
        </section>

        {/* SOAP note panel */}
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">SOAP Note</h3>
          </div>
          {(["Subjective", "Objective", "Assessment", "Plan"] as const).map(
            (section) => (
              <div key={section} className="mb-3 last:mb-0">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {section}
                </label>
                <div className="h-12 bg-slate-50 rounded-md border border-dashed border-slate-200 flex items-center justify-center">
                  <span className="text-xs text-slate-400">
                    Generated in Phase 8
                  </span>
                </div>
              </div>
            )
          )}
        </section>

        {/* Action bar */}
        <div className="flex items-center gap-3 pb-4">
          <button
            disabled
            className="px-4 py-2 text-sm font-medium text-slate-400 bg-white border border-slate-200 rounded-md cursor-not-allowed"
          >
            Save Draft
          </button>
          <button
            disabled
            className="px-4 py-2 text-sm font-medium text-slate-400 bg-white border border-slate-200 rounded-md cursor-not-allowed"
          >
            Request Review
          </button>
          <button
            disabled
            className="px-4 py-2 text-sm font-medium text-slate-400 bg-white border border-slate-200 rounded-md cursor-not-allowed"
          >
            Sign &amp; Finalize
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
