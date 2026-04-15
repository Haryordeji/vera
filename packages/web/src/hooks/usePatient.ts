import { useCallback } from "react";
import { useApi } from "@/lib/api";
import type { Patient, Allergy, Medication } from "@/lib/types";

export interface PatientInput {
  fullName: string;
  dateOfBirth?: string | null;
  mrn?: string | null;
  sex?: string | null;
  heightCm?: number | null;
  eyeColor?: string | null;
  bloodType?: string | null;
}

export interface AllergyInput {
  name: string;
  severity?: string | null;
  reaction?: string | null;
}

export interface MedicationInput {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
}

export function usePatient() {
  const { get, post, put, del } = useApi();

  const fetchPatients = useCallback(
    (search?: string, options?: { includeArchived?: boolean }) => {
      const params = new URLSearchParams();
      if (search?.trim()) params.set("search", search.trim());
      if (options?.includeArchived) params.set("includeArchived", "true");
      const qs = params.toString() ? `?${params.toString()}` : "";
      return get<Patient[]>(`/patients${qs}`);
    },
    [get]
  );

  const fetchPatient = useCallback(
    (id: string) => get<Patient>(`/patients/${id}`),
    [get]
  );

  const archivePatient = useCallback(
    (id: string) => post<Patient>(`/patients/${id}/archive`),
    [post]
  );

  const unarchivePatient = useCallback(
    (id: string) => post<Patient>(`/patients/${id}/unarchive`),
    [post]
  );

  const createPatient = useCallback(
    (data: PatientInput) => post<Patient>("/patients", data),
    [post]
  );

  const updatePatient = useCallback(
    (id: string, data: Partial<PatientInput>) => put<Patient>(`/patients/${id}`, data),
    [put]
  );

  const addAllergy = useCallback(
    (patientId: string, data: AllergyInput) =>
      post<Allergy>(`/patients/${patientId}/allergies`, data),
    [post]
  );

  const deleteAllergy = useCallback(
    (patientId: string, allergyId: string) =>
      del(`/patients/${patientId}/allergies/${allergyId}`),
    [del]
  );

  const addMedication = useCallback(
    (patientId: string, data: MedicationInput) =>
      post<Medication>(`/patients/${patientId}/medications`, data),
    [post]
  );

  const updateMedication = useCallback(
    (patientId: string, medicationId: string, data: Partial<MedicationInput>) =>
      put<Medication>(`/patients/${patientId}/medications/${medicationId}`, data),
    [put]
  );

  const deleteMedication = useCallback(
    (patientId: string, medicationId: string) =>
      del(`/patients/${patientId}/medications/${medicationId}`),
    [del]
  );

  return {
    fetchPatients,
    fetchPatient,
    createPatient,
    updatePatient,
    archivePatient,
    unarchivePatient,
    addAllergy,
    deleteAllergy,
    addMedication,
    updateMedication,
    deleteMedication,
  };
}
