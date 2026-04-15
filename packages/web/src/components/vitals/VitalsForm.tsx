import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Vitals } from "@/lib/types";

interface Props {
  sessionId: string;
  /** If provided, the form is pre-filled and submits via PUT instead of POST. */
  initial?: Vitals | null;
  onSaved: (vitals: Vitals) => void;
  onCancel?: () => void;
}

interface FormState {
  weightKg: string;
  bloodPressureSys: string;
  bloodPressureDia: string;
  heartRate: string;
  temperatureC: string;
  respiratoryRate: string;
  oxygenSaturation: string;
}

const EMPTY_FORM: FormState = {
  weightKg: "",
  bloodPressureSys: "",
  bloodPressureDia: "",
  heartRate: "",
  temperatureC: "",
  respiratoryRate: "",
  oxygenSaturation: "",
};

function toFormState(v: Vitals | null | undefined): FormState {
  if (!v) return EMPTY_FORM;
  return {
    weightKg: v.weightKg?.toString() ?? "",
    bloodPressureSys: v.bloodPressureSys?.toString() ?? "",
    bloodPressureDia: v.bloodPressureDia?.toString() ?? "",
    heartRate: v.heartRate?.toString() ?? "",
    temperatureC: v.temperatureC?.toString() ?? "",
    respiratoryRate: v.respiratoryRate?.toString() ?? "",
    oxygenSaturation: v.oxygenSaturation?.toString() ?? "",
  };
}

function parseNum(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function VitalsForm({ sessionId, initial, onSaved, onCancel }: Props) {
  const { post, put } = useApi();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial;

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        weightKg: parseNum(form.weightKg),
        bloodPressureSys: parseNum(form.bloodPressureSys),
        bloodPressureDia: parseNum(form.bloodPressureDia),
        heartRate: parseNum(form.heartRate),
        temperatureC: parseNum(form.temperatureC),
        respiratoryRate: parseNum(form.respiratoryRate),
        oxygenSaturation: parseNum(form.oxygenSaturation),
      };
      const saved = isEdit
        ? await put<Vitals>(`/sessions/${sessionId}/vitals`, payload)
        : await post<Vitals>(`/sessions/${sessionId}/vitals`, payload);
      onSaved(saved);
      showToast(isEdit ? "Vitals updated" : "Vitals saved");
    } catch {
      showToast("Failed to save vitals", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="vitals-form"
      className="space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <VitalField
          label="Weight"
          unit="kg"
          value={form.weightKg}
          onChange={(v) => update("weightKg", v)}
          step="0.1"
          min={0}
          max={500}
          ariaLabel="Weight in kilograms"
          testId="vitals-input-weight"
        />
        <VitalField
          label="BP Systolic"
          unit="mmHg"
          value={form.bloodPressureSys}
          onChange={(v) => update("bloodPressureSys", v)}
          step="1"
          min={60}
          max={250}
          ariaLabel="Blood pressure systolic"
          testId="vitals-input-bp-sys"
        />
        <VitalField
          label="BP Diastolic"
          unit="mmHg"
          value={form.bloodPressureDia}
          onChange={(v) => update("bloodPressureDia", v)}
          step="1"
          min={40}
          max={150}
          ariaLabel="Blood pressure diastolic"
          testId="vitals-input-bp-dia"
        />
        <VitalField
          label="Heart Rate"
          unit="bpm"
          value={form.heartRate}
          onChange={(v) => update("heartRate", v)}
          step="1"
          min={30}
          max={250}
          ariaLabel="Heart rate"
          testId="vitals-input-hr"
        />
        <VitalField
          label="Temperature"
          unit="°C"
          value={form.temperatureC}
          onChange={(v) => update("temperatureC", v)}
          step="0.1"
          min={34}
          max={42}
          ariaLabel="Temperature in Celsius"
          testId="vitals-input-temp"
        />
        <VitalField
          label="Respiratory Rate"
          unit="/min"
          value={form.respiratoryRate}
          onChange={(v) => update("respiratoryRate", v)}
          step="1"
          min={8}
          max={60}
          ariaLabel="Respiratory rate"
          testId="vitals-input-rr"
        />
        <VitalField
          label="SpO₂"
          unit="%"
          value={form.oxygenSaturation}
          onChange={(v) => update("oxygenSaturation", v)}
          step="0.1"
          min={70}
          max={100}
          ariaLabel="Oxygen saturation"
          testId="vitals-input-spo2"
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          data-testid="vitals-save"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {saving ? "Saving…" : "Save Vitals"}
        </button>
      </div>
    </form>
  );
}

interface VitalFieldProps {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  step: string;
  min: number;
  max: number;
  ariaLabel: string;
  testId: string;
}

function VitalField({
  label,
  unit,
  value,
  onChange,
  step,
  min,
  max,
  ariaLabel,
  testId,
}: VitalFieldProps) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          data-testid={testId}
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-xs text-slate-500 w-10 shrink-0">{unit}</span>
      </div>
    </div>
  );
}
