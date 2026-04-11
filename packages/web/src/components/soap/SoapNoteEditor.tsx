import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SoapContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

const SECTIONS = [
  {
    key: "subjective" as const,
    label: "Subjective",
    hint: "Chief complaint and history as reported by the patient",
    color: "border-blue-200 bg-blue-50",
    labelColor: "text-blue-700",
  },
  {
    key: "objective" as const,
    label: "Objective",
    hint: "Physical exam findings, vitals, and clinical observations",
    color: "border-green-200 bg-green-50",
    labelColor: "text-green-700",
  },
  {
    key: "assessment" as const,
    label: "Assessment",
    hint: "Clinical impression and differential diagnosis",
    color: "border-yellow-200 bg-yellow-50",
    labelColor: "text-yellow-700",
  },
  {
    key: "plan" as const,
    label: "Plan",
    hint: "Treatment plan, medications, follow-up, and next steps",
    color: "border-purple-200 bg-purple-50",
    labelColor: "text-purple-700",
  },
];

interface Props {
  note: SoapContent | null;
  loading?: boolean;
  onChange?: (field: keyof SoapContent, value: string) => void;
}

export function SoapNoteEditor({ note, loading = false, onChange }: Props) {
  const [localNote, setLocalNote] = useState<SoapContent | null>(note);

  // Sync when note prop changes (e.g. after generation)
  useEffect(() => {
    setLocalNote(note);
  }, [note]);

  const handleChange = (field: keyof SoapContent, value: string) => {
    setLocalNote((prev) =>
      prev ? { ...prev, [field]: value } : null
    );
    onChange?.(field, value);
  };

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-10 gap-3"
        data-testid="soap-loading"
      >
        <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
        <p className="text-sm text-slate-500">Generating SOAP note…</p>
      </div>
    );
  }

  if (!localNote) {
    return (
      <div
        className="flex items-center justify-center h-20 bg-slate-50 rounded-md border border-dashed border-slate-200"
        data-testid="soap-empty"
      >
        <p className="text-sm text-slate-400">
          SOAP note will appear here after transcription.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="soap-editor">
      {SECTIONS.map(({ key, label, hint, color, labelColor }) => (
        <div
          key={key}
          className={cn("rounded-lg border p-4", color)}
          data-testid={`soap-section-${key}`}
        >
          <div className="mb-2">
            <span
              className={cn("text-xs font-bold uppercase tracking-widest", labelColor)}
              data-testid={`soap-label-${key}`}
            >
              {label}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
          </div>
          <textarea
            value={localNote[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            data-testid={`soap-textarea-${key}`}
            rows={4}
            className="w-full text-sm text-slate-800 bg-white rounded-md border border-slate-200 px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400 resize-y"
          />
        </div>
      ))}
    </div>
  );
}
