import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Utterance {
  speaker: "Doctor" | "Patient";
  text: string;
  start: number;
  end: number;
}

interface Props {
  utterances: Utterance[];
  loading?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TranscriptViewer({ utterances, loading = false }: Props) {
  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-10 gap-3"
        data-testid="transcript-loading"
      >
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        <p className="text-sm text-slate-500">Transcribing your recording…</p>
      </div>
    );
  }

  if (utterances.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-20 bg-slate-50 rounded-md border border-dashed border-slate-200"
        data-testid="transcript-empty"
      >
        <p className="text-sm text-slate-400">Transcript will appear here after recording.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="transcript-content">
      {utterances.map((u, i) => {
        const isDoctor = u.speaker === "Doctor";
        return (
          <div
            key={i}
            data-testid={`utterance-${i}`}
            data-speaker={u.speaker}
            className={cn(
              "rounded-lg px-4 py-3 max-w-[85%]",
              isDoctor
                ? "bg-blue-50 border border-blue-100 ml-0"
                : "bg-slate-50 border border-slate-200 ml-auto"
            )}
          >
            <div className="flex items-center justify-between gap-4 mb-1">
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  isDoctor ? "text-blue-600" : "text-slate-500"
                )}
                data-testid={`speaker-label-${i}`}
              >
                {u.speaker}
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                {formatTime(u.start)}
              </span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">{u.text}</p>
          </div>
        );
      })}
    </div>
  );
}
