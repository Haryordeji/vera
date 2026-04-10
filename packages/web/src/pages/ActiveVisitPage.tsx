import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Mic, FileText, ClipboardList } from "lucide-react";

function AuditPlaceholder() {
  const events = [
    { label: "Visit started", time: "—", color: "bg-blue-400" },
    { label: "Audio captured", time: "—", color: "bg-green-400" },
    { label: "Transcript generated", time: "—", color: "bg-purple-400" },
    { label: "SOAP draft created", time: "—", color: "bg-yellow-400" },
  ];

  return (
    <div className="space-y-4">
      {events.map(({ label, time, color }) => (
        <div key={label} className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${color}`} />
          <div>
            <p className="text-sm text-slate-700 font-medium">{label}</p>
            <p className="text-xs text-slate-400">{time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ActiveVisitPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <AppLayout
      title="Active Visit"
      rightPanel={<AuditPlaceholder />}
    >
      <div className="px-6 py-6 space-y-6 max-w-3xl mx-auto">
        {/* Visit header */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Visit {id ?? "—"}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Active encounter workspace
          </p>
        </div>

        {/* Audio recorder panel */}
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              Audio Recording
            </h3>
          </div>
          <div className="flex items-center justify-center h-20 bg-slate-50 rounded-md border border-dashed border-slate-200">
            <p className="text-sm text-slate-400">
              Audio recorder will be implemented in Phase 6.
            </p>
          </div>
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
          {["Subjective", "Objective", "Assessment", "Plan"].map((section) => (
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
          ))}
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
