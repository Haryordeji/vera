import { useState } from "react";
import { Pencil, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { usePatient, type PatientInput } from "@/hooks/usePatient";
import type { Patient } from "@/lib/types";

interface Props {
  patient: Patient;
  onUpdated: (patient: Patient) => void;
}

function formatDob(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toInputDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function PatientProfile({ patient, onUpdated }: Props) {
  const { updatePatient } = usePatient();
  const { showToast } = useToast();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PatientInput>(() => ({
    fullName: patient.fullName,
    dateOfBirth: toInputDate(patient.dateOfBirth),
    mrn: patient.mrn ?? "",
    sex: patient.sex ?? "",
    heightCm: patient.heightCm,
    eyeColor: patient.eyeColor ?? "",
    bloodType: patient.bloodType ?? "",
  }));

  function openEdit() {
    setForm({
      fullName: patient.fullName,
      dateOfBirth: toInputDate(patient.dateOfBirth),
      mrn: patient.mrn ?? "",
      sex: patient.sex ?? "",
      heightCm: patient.heightCm,
      eyeColor: patient.eyeColor ?? "",
      bloodType: patient.bloodType ?? "",
    });
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      showToast("Full name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const updated = await updatePatient(patient.id, {
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth || null,
        mrn: form.mrn?.trim() || null,
        sex: form.sex || null,
        heightCm: form.heightCm ?? null,
        eyeColor: form.eyeColor?.trim() || null,
        bloodType: form.bloodType || null,
      });
      onUpdated({ ...patient, ...updated });
      setEditing(false);
      showToast("Profile updated");
    } catch {
      showToast("Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        data-testid="patient-profile-edit"
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Edit Profile</h3>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Cancel edit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <Field label="Full name">
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className={inputCls}
            aria-label="Full name"
          />
        </Field>
        <Field label="Date of birth">
          <input
            type="date"
            value={form.dateOfBirth ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            className={inputCls}
            aria-label="Date of birth"
          />
        </Field>
        <Field label="MRN">
          <input
            type="text"
            value={form.mrn ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, mrn: e.target.value }))}
            className={inputCls}
            aria-label="Medical record number"
          />
        </Field>
        <Field label="Sex">
          <select
            value={form.sex ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}
            className={inputCls}
            aria-label="Sex"
          >
            <option value="">—</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Height (cm)">
          <input
            type="number"
            step="0.1"
            value={form.heightCm ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                heightCm: e.target.value ? Number(e.target.value) : null,
              }))
            }
            className={inputCls}
            aria-label="Height in centimeters"
          />
        </Field>
        <Field label="Eye color">
          <input
            type="text"
            value={form.eyeColor ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, eyeColor: e.target.value }))}
            className={inputCls}
            aria-label="Eye color"
          />
        </Field>
        <Field label="Blood type">
          <select
            value={form.bloodType ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, bloodType: e.target.value }))}
            className={inputCls}
            aria-label="Blood type"
          >
            <option value="">—</option>
            {BLOOD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div data-testid="patient-profile" className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 truncate">
            {patient.fullName}
          </h2>
        </div>
        <button
          onClick={openEdit}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 shrink-0"
          aria-label="Edit profile"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>

      <dl className="space-y-1.5 text-xs">
        <Row label="DOB">{formatDob(patient.dateOfBirth)}</Row>
        <Row label="MRN">{patient.mrn ?? "—"}</Row>
        <Row label="Sex">{patient.sex ?? "—"}</Row>
        <Row label="Height">
          {patient.heightCm != null ? `${patient.heightCm} cm` : "—"}
        </Row>
        <Row label="Eye color">{patient.eyeColor ?? "—"}</Row>
        <Row label="Blood type">{patient.bloodType ?? "—"}</Row>
      </dl>
    </div>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-slate-400 w-20 shrink-0">{label}</dt>
      <dd className="text-slate-800 font-medium">{children}</dd>
    </div>
  );
}
