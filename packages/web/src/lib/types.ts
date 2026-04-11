export type SessionStatus =
  | "RECORDING"
  | "TRANSCRIBING"
  | "GENERATING_NOTE"
  | "IN_REVIEW"
  | "COMPLETED";

export type WorkflowStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED";

export interface Patient {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  mrn: string | null;
  createdAt: string;
  updatedAt: string;
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
