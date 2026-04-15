import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useApi } from "@/lib/api";
import type { Patient, Session } from "@/lib/types";
import { Search, UserRound, Plus, X, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewPatientForm {
  fullName: string;
  dateOfBirth: string;
  mrn: string;
}

export default function NewVisitPage() {
  const api = useApi();
  const navigate = useNavigate();

  // Patient search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Inline create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewPatientForm>({ fullName: "", dateOfBirth: "", mrn: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Session creation
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // Debounced patient search
  useEffect(() => {
    if (selectedPatient) return; // already selected, don't re-search
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const patients = await api.get<Patient[]>(`/patients?search=${encodeURIComponent(query)}`);
        setResults(patients);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, api, selectedPatient]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setQuery(p.fullName);
    setShowDropdown(false);
    setShowCreate(false);
    setStartError("");
  }

  function clearSelection() {
    setSelectedPatient(null);
    setQuery("");
    setResults([]);
    setStartError("");
  }

  async function handleCreatePatient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setCreateError("Full name is required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const patient = await api.post<Patient>("/patients", {
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        mrn: form.mrn.trim() || undefined,
      });
      selectPatient(patient);
      setShowCreate(false);
      setForm({ fullName: "", dateOfBirth: "", mrn: "" });
    } catch {
      setCreateError("Failed to create patient. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStartVisit() {
    if (!selectedPatient) return;
    setStarting(true);
    setStartError("");
    try {
      const session = await api.post<Session>("/sessions", { patientId: selectedPatient.id });
      navigate(`/visits/${session.id}`);
    } catch {
      setStartError("Failed to start visit. Please try again.");
      setStarting(false);
    }
  }

  return (
    <AppLayout title="New Visit">
      <div className="px-6 py-6 max-w-2xl mx-auto space-y-6">
        <div>
          <PageHeader
            title="New Visit"
            backTo="/"
            backLabel="Back to Dashboard"
          />
          <p className="-mt-3 text-slate-500">
            Select an existing patient or create a new one to begin.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
          {/* Patient search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Patient
            </label>
            <div ref={searchRef} className="relative">
              <div className="relative flex items-center">
                {searching ? (
                  <Loader2 className="absolute left-3 w-4 h-4 text-slate-400 animate-spin" />
                ) : (
                  <Search className="absolute left-3 w-4 h-4 text-slate-400" />
                )}
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (selectedPatient) setSelectedPatient(null);
                  }}
                  onFocus={() => results.length > 0 && setShowDropdown(true)}
                  placeholder="Search by name or MRN…"
                  className={cn(
                    "w-full pl-9 pr-9 py-2 border rounded-md text-sm outline-none transition-colors",
                    selectedPatient
                      ? "border-green-400 bg-green-50 text-slate-700"
                      : "border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  )}
                  aria-label="Search patients"
                />
                {(query || selectedPatient) && (
                  <button
                    onClick={clearSelection}
                    className="absolute right-3 text-slate-400 hover:text-slate-600"
                    aria-label="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Dropdown results */}
              {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
                  {results.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">No patients found.</p>
                  ) : (
                    results.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                      >
                        <UserRound className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.fullName}</p>
                          {p.mrn && (
                            <p className="text-xs text-slate-400">MRN: {p.mrn}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-auto shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedPatient && (
              <p className="mt-1.5 text-xs text-green-700">
                ✓ Selected: {selectedPatient.fullName}
                {selectedPatient.mrn && ` (MRN: ${selectedPatient.mrn})`}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-100" />
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 border-t border-slate-100" />
          </div>

          {/* Create new patient toggle */}
          {!showCreate ? (
            <button
              onClick={() => { setShowCreate(true); setSelectedPatient(null); setQuery(""); }}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Patient
            </button>
          ) : (
            <form onSubmit={handleCreatePatient} className="space-y-3 border border-blue-100 rounded-md p-4 bg-blue-50/40">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-slate-700">New Patient</p>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(""); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="e.g. Jane Smith"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  aria-label="Patient full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    aria-label="Date of birth"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">MRN</label>
                  <input
                    type="text"
                    value={form.mrn}
                    onChange={(e) => setForm((f) => ({ ...f, mrn: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    aria-label="Medical record number"
                  />
                </div>
              </div>

              {createError && (
                <p className="text-xs text-red-600">{createError}</p>
              )}

              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded transition-colors"
              >
                {creating && <Loader2 className="w-3 h-3 animate-spin" />}
                {creating ? "Creating…" : "Create Patient"}
              </button>
            </form>
          )}
        </div>

        {/* Start Visit */}
        {startError && (
          <p className="text-sm text-red-600">{startError}</p>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleStartVisit}
            disabled={!selectedPatient || starting}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium rounded-md transition-colors"
            aria-label="Start visit"
          >
            {starting && <Loader2 className="w-4 h-4 animate-spin" />}
            {starting ? "Starting…" : "Start Visit"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
