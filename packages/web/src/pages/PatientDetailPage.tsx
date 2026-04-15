import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Archive, RotateCcw, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { usePatient } from "@/hooks/usePatient";
import type { Patient, Allergy, Medication } from "@/lib/types";
import { PatientProfile } from "@/components/patient/PatientProfile";
import { AllergyList } from "@/components/patient/AllergyList";
import { MedicationList } from "@/components/patient/MedicationList";
import { PatientVisitHistory } from "@/components/patient/PatientVisitHistory";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchPatient, archivePatient, unarchivePatient } = usePatient();
  const { showToast } = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchPatient(id);
        if (!cancelled) setPatient(result);
      } catch {
        if (!cancelled) showToast("Failed to load patient", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // showToast omitted: its identity changes on every ToastProvider render,
    // which would re-trigger the fetch in a loop when the toast itself causes
    // a provider re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fetchPatient]);

  const handleProfileUpdated = useCallback((updated: Patient) => {
    setPatient((prev) => (prev ? { ...prev, ...updated } : updated));
  }, []);

  const handleAllergiesChange = useCallback((next: Allergy[]) => {
    setPatient((prev) => (prev ? { ...prev, allergies: next } : prev));
  }, []);

  const handleMedicationsChange = useCallback((next: Medication[]) => {
    setPatient((prev) => (prev ? { ...prev, medications: next } : prev));
  }, []);

  const isArchived = !!patient?.archivedAt;

  const handleConfirmArchive = async () => {
    if (!patient || archiving) return;
    setArchiving(true);
    try {
      await archivePatient(patient.id);
      setConfirmOpen(false);
      showToast("Patient archived");
      navigate("/patients");
    } catch {
      showToast("Failed to archive patient", "error");
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!patient || archiving) return;
    setArchiving(true);
    try {
      const updated = await unarchivePatient(patient.id);
      setPatient((prev) => (prev ? { ...prev, ...updated } : prev));
      showToast("Patient restored");
    } catch {
      showToast("Failed to unarchive patient", "error");
    } finally {
      setArchiving(false);
    }
  };

  const headerAction = patient && !loading
    ? isArchived
      ? (
          <button
            type="button"
            onClick={handleUnarchive}
            disabled={archiving}
            data-testid="patient-unarchive-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
          >
            {archiving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Unarchive Patient
          </button>
        )
      : (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            data-testid="patient-archive-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-700"
          >
            <Archive className="w-4 h-4" />
            Archive Patient
          </button>
        )
    : null;

  return (
    <AppLayout title={patient?.fullName ?? "Patient Detail"}>
      <div className="px-6 py-6 max-w-6xl mx-auto">
        <PageHeader
          title={patient?.fullName ?? "Patient Detail"}
          backTo="/patients"
          backLabel="Back to Patients"
        >
          {headerAction}
        </PageHeader>

        {isArchived && (
          <div
            data-testid="patient-archived-banner"
            className="mb-4 -mt-2 inline-flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-3 py-1"
          >
            <Archive className="w-3.5 h-3.5" />
            Archived — hidden from the default patient list
          </div>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title="Archive this patient?"
          message="Are you sure you want to archive this patient? They will be hidden from the patient list but all data will be preserved."
          confirmLabel={archiving ? "Archiving…" : "Archive Patient"}
          confirmClassName="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 disabled:opacity-50"
          onConfirm={handleConfirmArchive}
          onCancel={() => setConfirmOpen(false)}
        />

        {loading ? (
          <div
            data-testid="patient-detail-skeleton"
            className="flex flex-col lg:flex-row gap-6 items-start"
          >
            <div className="flex-1 min-w-0 w-full space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-9 w-32" />
              </div>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-slate-200 px-5 py-4 space-y-2"
                >
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
            <aside className="w-full lg:w-80 bg-white rounded-lg border border-slate-200 p-5 space-y-4 shrink-0">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-full" />
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-full" />
              </div>
            </aside>
          </div>
        ) : !patient ? (
          <div className="bg-white rounded-lg border border-slate-200 px-5 py-16 text-center">
            <h2 className="text-base font-medium text-slate-700">Patient not found</h2>
          </div>
        ) : (
          <div
            data-testid="patient-detail-layout"
            className="flex flex-col lg:flex-row gap-6 items-start"
          >
            {/* Left column — visit history (scrolls with page) */}
            <div className="flex-1 min-w-0 w-full">
              <PatientVisitHistory
                patientId={patient.id}
                visits={patient.sessions ?? []}
              />
            </div>

            {/* Right column — sticky profile */}
            <aside
              data-testid="patient-detail-sticky"
              className="w-full lg:w-80 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto bg-white rounded-lg border border-slate-200 p-5 space-y-5 shrink-0"
            >
              <PatientProfile patient={patient} onUpdated={handleProfileUpdated} />
              <div className="border-t border-slate-100 pt-4">
                <AllergyList
                  patientId={patient.id}
                  allergies={patient.allergies ?? []}
                  onChange={handleAllergiesChange}
                />
              </div>
              <div className="border-t border-slate-100 pt-4">
                <MedicationList
                  patientId={patient.id}
                  medications={patient.medications ?? []}
                  onChange={handleMedicationsChange}
                />
              </div>
            </aside>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
