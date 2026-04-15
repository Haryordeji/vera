import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { usePatient, type AllergyInput } from "@/hooks/usePatient";
import type { Allergy } from "@/lib/types";

interface Props {
  patientId: string;
  allergies: Allergy[];
  onChange: (next: Allergy[]) => void;
  /** When false, the component is display-only: no delete X's and no Add form. Defaults to true for standalone usage. */
  editable?: boolean;
}

const SEVERITY_STYLE: Record<string, string> = {
  Severe: "bg-red-100 text-red-700 border-red-200",
  Moderate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Mild: "bg-green-100 text-green-700 border-green-200",
};

function chipClass(severity: string | null) {
  if (severity && SEVERITY_STYLE[severity]) return SEVERITY_STYLE[severity];
  return "bg-slate-100 text-slate-700 border-slate-200";
}

const EMPTY: AllergyInput = { name: "", severity: "", reaction: "" };

export function AllergyList({ patientId, allergies, onChange, editable = true }: Props) {
  const { addAllergy, deleteAllergy } = usePatient();
  const { showToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AllergyInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast("Allergy name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const created = await addAllergy(patientId, {
        name: form.name.trim(),
        severity: form.severity || null,
        reaction: form.reaction?.trim() || null,
      });
      onChange([...allergies, created]);
      setForm(EMPTY);
      setShowForm(false);
      showToast("Allergy added");
    } catch {
      showToast("Failed to add allergy", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(allergyId: string) {
    setDeletingId(allergyId);
    try {
      await deleteAllergy(patientId, allergyId);
      onChange(allergies.filter((a) => a.id !== allergyId));
      showToast("Allergy removed");
    } catch {
      showToast("Failed to remove allergy", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section data-testid="allergy-list" className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Allergies
      </h3>

      {allergies.length === 0 ? (
        <p className="text-xs text-slate-400">No known allergies.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {allergies.map((a) => (
            <li
              key={a.id}
              data-testid={`allergy-chip-${a.id}`}
              data-severity={a.severity ?? ""}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${chipClass(
                a.severity
              )}`}
            >
              <span className="font-medium">{a.name}</span>
              {a.severity && <span className="text-[10px] opacity-80">· {a.severity}</span>}
              {editable && (
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  aria-label={`Remove allergy ${a.name}`}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  {deletingId === a.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!editable ? null : showForm ? (
        <form
          onSubmit={handleAdd}
          data-testid="allergy-form"
          className="space-y-2 p-2.5 border border-slate-200 rounded bg-slate-50"
        >
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Allergy name (e.g. Penicillin)"
            aria-label="Allergy name"
            className={inputCls}
          />
          <select
            value={form.severity ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
            aria-label="Allergy severity"
            className={inputCls}
          >
            <option value="">Severity (optional)</option>
            <option value="Mild">Mild</option>
            <option value="Moderate">Moderate</option>
            <option value="Severe">Severe</option>
          </select>
          <input
            type="text"
            value={form.reaction ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, reaction: e.target.value }))}
            placeholder="Reaction (optional)"
            aria-label="Allergy reaction"
            className={inputCls}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY);
              }}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
            >
              Cancel
            </button>
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
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="w-3 h-3" />
          Add Allergy
        </button>
      )}
    </section>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white";
