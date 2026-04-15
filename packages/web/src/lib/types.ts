export type SessionStatus =
  | "RECORDING"
  | "TRANSCRIBING"
  | "GENERATING_NOTE"
  | "IN_REVIEW"
  | "COMPLETED";

export type WorkflowStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED";

export interface Allergy {
  id: string;
  patientId: string;
  name: string;
  severity: string | null;
  reaction: string | null;
  createdAt: string;
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  createdAt: string;
}

export interface Vitals {
  id: string;
  sessionId: string;
  weightKg: number | null;
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  recordedAt: string;
}

export interface PatientSummary {
  id: string;
  status: SessionStatus;
  recordedAt: string;
  physician: { fullName: string };
  soapNote: { workflowStatus: WorkflowStatus } | null;
}

export interface Patient {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  mrn: string | null;
  sex: string | null;
  heightCm: number | null;
  eyeColor: string | null;
  bloodType: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated by GET /api/patients (list)
  _count?: {
    allergies: number;
    medications: number;
    sessions: number;
  };
  // Populated by GET /api/patients/:id (detail)
  allergies?: Allergy[];
  medications?: Medication[];
  sessions?: PatientSummary[];
}

export interface AuditEvent {
  id: string;
  sessionId: string;
  eventType: string;
  description: string | null;
  author: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Transcript {
  id: string;
  sessionId: string;
  rawDiarizedText: string;
  plainText: string;
  generatedAt: string;
}

export interface SoapNote {
  id: string;
  sessionId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  workflowStatus: WorkflowStatus;
  approvedAt: string | null;
  approvedById: string | null;
  approvedBy?: Physician | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  physicianId: string;
  patientId: string;
  status: SessionStatus;
  recordedAt: string;
  audioFileUrl: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated by GET /api/sessions and GET /api/sessions/:id
  patient?: Patient;
  physician?: Physician;
  transcript?: Transcript | null;
  soapNote?: SoapNote | null;
  vitals?: Vitals | null;
  auditEvents?: AuditEvent[];
}

export interface Physician {
  id: string;
  clerkId: string;
  fullName: string;
  email: string;
  credentials: string | null;
  createdAt: string;
  updatedAt: string;
}
