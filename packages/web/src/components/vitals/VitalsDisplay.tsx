import { Pencil } from "lucide-react";
import type { Vitals } from "@/lib/types";

interface Props {
  vitals: Vitals;
  onEdit?: () => void;
}

type Severity = "normal" | "borderline" | "critical";

function classifyHR(v: number | null): Severity {
  if (v == null) return "normal";
  if (v > 120 || v < 50) return "critical";
  if (v > 100 || v < 60) return "borderline";
  return "normal";
}

function classifyTemp(v: number | null): Severity {
  if (v == null) return "normal";
  if (v > 39) return "critical";
  if (v > 38) return "borderline";
  return "normal";
}

function classifySpO2(v: number | null): Severity {
  if (v == null) return "normal";
  if (v < 90) return "critical";
  if (v < 95) return "borderline";
  return "normal";
}

function classifyBpSys(v: number | null): Severity {
  if (v == null) return "normal";
  if (v > 180 || v < 80) return "critical";
  if (v > 140 || v < 90) return "borderline";
  return "normal";
}

const SEVERITY_CLASS: Record<Severity, string> = {
  normal: "text-slate-900",
  borderline: "text-yellow-700 bg-yellow-50",
  critical: "text-red-700 bg-red-50",
};

function format(n: number | null, digits = 0): string {
  if (n == null) return "--";
  return digits > 0 ? n.toFixed(digits) : String(n);
}

export function VitalsDisplay({ vitals, onEdit }: Props) {
  const items: Array<{
    label: string;
    value: string;
    unit: string;
    severity: Severity;
    testId: string;
  }> = [
    {
      label: "Weight",
      value: format(vitals.weightKg, 1),
      unit: "kg",
      severity: "normal",
      testId: "vitals-display-weight",
    },
    {
      label: "BP Systolic",
      value: format(vitals.bloodPressureSys),
      unit: "mmHg",
      severity: classifyBpSys(vitals.bloodPressureSys),
      testId: "vitals-display-bp-sys",
    },
    {
      label: "BP Diastolic",
      value: format(vitals.bloodPressureDia),
      unit: "mmHg",
      severity: "normal",
      testId: "vitals-display-bp-dia",
    },
    {
      label: "Heart Rate",
      value: format(vitals.heartRate),
      unit: "bpm",
      severity: classifyHR(vitals.heartRate),
      testId: "vitals-display-hr",
    },
    {
      label: "Temperature",
      value: format(vitals.temperatureC, 1),
      unit: "°C",
      severity: classifyTemp(vitals.temperatureC),
      testId: "vitals-display-temp",
    },
    {
      label: "Respiratory Rate",
      value: format(vitals.respiratoryRate),
      unit: "/min",
      severity: "normal",
      testId: "vitals-display-rr",
    },
    {
      label: "SpO₂",
      value: format(vitals.oxygenSaturation, 1),
      unit: "%",
      severity: classifySpO2(vitals.oxygenSaturation),
      testId: "vitals-display-spo2",
    },
  ];

  return (
    <div data-testid="vitals-display" className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {items.map((item) => (
          <div
            key={item.testId}
            data-testid={item.testId}
            data-severity={item.severity}
            className={`px-3 py-2 rounded border border-slate-200 ${
              item.severity === "normal" ? "bg-white" : SEVERITY_CLASS[item.severity]
            }`}
          >
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
              {item.label}
            </p>
            <p
              className={`text-sm font-semibold mt-0.5 ${
                item.severity !== "normal" ? "" : "text-slate-900"
              }`}
            >
              {item.value}
              {item.value !== "--" && (
                <span className="text-[11px] font-normal text-slate-500 ml-1">
                  {item.unit}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
      {onEdit && (
        <div className="flex justify-end">
          <button
            onClick={onEdit}
            data-testid="vitals-edit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
