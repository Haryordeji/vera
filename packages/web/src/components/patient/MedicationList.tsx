import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { usePatient, type MedicationInput } from "@/hooks/usePatient";
import type { Medication } from "@/lib/types";

interface Props {
  patientId: string;
  medications: Medication[];
  onChange: (next: Medication[]) => void;
}

const EMPTY: MedicationInput = { name: "", dosage: "", frequency: "" };

export function MedicationList({ patientId, medications, onChange }: Props) {
  const { addMedication, updateMedication, deleteMedication } = usePatient();
  const { showToast } = useToast();

  const [mode, setMode] = useState<"idle" | "add" | "edit">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MedicationInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setMode("add");
  }

  function startEdit(m: Medication) {
    setForm({
      name: m.name,
      dosage: m.dosage ?? "",
      frequency: m.frequency ?? "",
    });
    setEditingId(m.id);
    setMode("edit");
  }

  function cancelForm() {
    setMode("idle");
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast("Medication name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        dosage: form.dosage?.trim() || null,
        frequency: form.frequency?.trim() || null,
      };
      if (mode === "add") {
        const created = await addMedication(patientId, payload);
        onChange([...medications, created]);
        showToast("Medication added");
      } else if (mode === "edit" && editingId) {
        const updated = await updateMedication(patientId, editingId, payload);
        onChange(medications.map((m) => (m.id === editingId ? updated : m)));
        showToast("Medication updated");
      }
      cancelForm();
    } catch {
      showToast("Failed to save medication", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(medicationId: string) {
    setDeletingId(medicationId);
    try {
      await deleteMedication(patientId, medicationId);
      onChange(medications.filter((m) => m.id !== medicationId));
      showToast("Medication removed");
    } catch {
      showToast("Failed to remove medication", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section data-testid="medication-list" className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Medications
      </h3>

      {medications.length === 0 ? (
        <p className="text-xs text-slate-400">No medications recorded.</p>
      ) : (
        <ul className="space-y-1.5">
          {medications.map((m) => (
            <li
              key={m.id}
              data-testid={`medication-row-${m.id}`}
              className="flex items-start justify-between gap-2 px-2.5 py-1.5 border border-slate-200 rounded bg-white"
            >
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-slate-800 truncate">
                  {m.name}
                  {m.dosage && <span className="font-normal text-slate-600"> · {m.dosage}</span>}
                </p>
                {m.frequency && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{m.frequency}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEdit(m)}
                  aria-label={`Edit medication ${m.name}`}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  aria-label={`Remove medication ${m.name}`}
                  className="p-1 text-slate-400 hover:text-red-600"
                >
                  {deletingId === m.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {mode !== "idle" ? (
        <form
          onSubmit={handleSubmit}
          data-testid="medication-form"
          className="space-y-2 p-2.5 border border-slate-200 rounded bg-slate-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-600">
              {mode === "add" ? "New medication" : "Edit medication"}
            </span>
            <button
              type="button"
              onClick={cancelForm}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Cancel medication form"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Medication name"
            aria-label="Medication name"
            className={inputCls}
          />
          <input
            type="text"
            value={form.dosage ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
            placeholder="Dosage (e.g. 10mg)"
            aria-label="Medication dosage"
            className={inputCls}
          />
          <input
            type="text"
            value={form.frequency ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
            placeholder="Frequency (e.g. Once daily)"
            aria-label="Medication frequency"
            className={inputCls}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={startAdd}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="w-3 h-3" />
          Add Medication
        </button>
      )}
    </section>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white";
