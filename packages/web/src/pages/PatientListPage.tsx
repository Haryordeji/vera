import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PatientCard } from "@/components/patient/PatientCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { usePatient, type PatientInput } from "@/hooks/usePatient";
import type { Patient } from "@/lib/types";
import { Search, Plus, X, Loader2, Users } from "lucide-react";

const EMPTY_FORM: PatientInput = {
  fullName: "",
  dateOfBirth: "",
  mrn: "",
  sex: "",
  heightCm: null,
  eyeColor: "",
  bloodType: "",
};

export default function PatientListPage() {
  const { fetchPatients, createPatient, unarchivePatient } = usePatient();
  const { showToast } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<PatientInput>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadPatients = useCallback(
    async (searchTerm?: string, includeArchived?: boolean) => {
      try {
        const result = await fetchPatients(searchTerm, { includeArchived });
        setPatients(result);
      } catch {
        showToast("Failed to load patients", "error");
      } finally {
        setLoading(false);
      }
    },
    [fetchPatients, showToast]
  );

  // Initial load
  useEffect(() => {
    loadPatients(undefined, showArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search + archive toggle — refetch from API when they change
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      loadPatients(search, showArchived);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, showArchived]);

  const handlePatientUnarchived = useCallback((updated: Patient) => {
    setPatients((prev) =>
      showArchived
        ? prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
        : prev.filter((p) => p.id !== updated.id)
    );
    showToast("Patient restored");
  }, [showArchived, showToast]);

  async function handleCreatePatient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setCreateError("Full name is required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      await createPatient({
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth || null,
        mrn: form.mrn?.trim() || null,
        sex: form.sex || null,
        heightCm: form.heightCm ?? null,
        eyeColor: form.eyeColor?.trim() || null,
        bloodType: form.bloodType || null,
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      showToast("Patient created");
      setLoading(true);
      loadPatients(search, showArchived);
    } catch {
      setCreateError("Failed to create patient. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppLayout title="Patients">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Patients</h2>
          <p className="mt-1 text-slate-500">
            Manage your patient records and medical profiles.
          </p>
        </div>

        {/* Search + Add */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or MRN…"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              aria-label="Search patients"
            />
          </div>
          <button
            onClick={() => {
              setShowCreate((v) => !v);
              setCreateError("");
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add New Patient
          </button>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            data-testid="patient-show-archived-toggle"
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-400"
          />
          Show archived patients
        </label>

        {/* Create form */}
        {showCreate && (
          <form
            onSubmit={handleCreatePatient}
            className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
            data-testid="create-patient-form"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">New Patient</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError("");
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close create form"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Full Name" required>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  aria-label="Full name"
                />
              </Field>
              <Field label="Date of Birth">
                <input
                  type="date"
                  value={form.dateOfBirth ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  aria-label="Date of birth"
                />
              </Field>
              <Field label="MRN">
                <input
                  type="text"
                  value={form.mrn ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, mrn: e.target.value }))}
                  placeholder="Optional"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  aria-label="Medical record number"
                />
              </Field>
              <Field label="Sex">
                <select
                  value={form.sex ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
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
                  placeholder="e.g. 170"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  aria-label="Height in centimeters"
                />
              </Field>
              <Field label="Eye Color">
                <input
                  type="text"
                  value={form.eyeColor ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, eyeColor: e.target.value }))}
                  placeholder="e.g. Brown"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  aria-label="Eye color"
                />
              </Field>
              <Field label="Blood Type">
                <select
                  value={form.bloodType ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, bloodType: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  aria-label="Blood type"
                >
                  <option value="">—</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {createError && <p className="text-xs text-red-600">{createError}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors"
              >
                {creating && <Loader2 className="w-3 h-3 animate-spin" />}
                {creating ? "Creating…" : "Create Patient"}
              </button>
            </div>
          </form>
        )}

        {/* Patient list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-slate-200 px-5 py-4 flex items-center gap-4"
              >
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-60" />
                </div>
              </div>
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 px-5 py-16 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-slate-700 mb-1">
              {search.trim() ? "No matching patients" : "No patients yet"}
            </h3>
            <p className="text-sm text-slate-400">
              {search.trim()
                ? "Try adjusting your search."
                : "Add a patient to get started."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {patients.map((p) => (
              <PatientCard
                key={p.id}
                patient={p}
                unarchivePatient={unarchivePatient}
                onUnarchive={handlePatientUnarchived}
              />
            ))}
            <p className="text-xs text-slate-400 text-center pt-1">
              {patients.length} patient{patients.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
