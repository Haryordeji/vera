import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/visit/StatusBadge";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { TranscriptViewer } from "@/components/transcript/TranscriptViewer";
import type { Utterance } from "@/components/transcript/TranscriptViewer";
import { SoapNoteEditor } from "@/components/soap/SoapNoteEditor";
import type { SoapContent } from "@/components/soap/SoapNoteEditor";
import { SoapWorkflowActions } from "@/components/soap/SoapWorkflowActions";
import { AssignReviewDialog } from "@/components/soap/AssignReviewDialog";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { VitalsForm } from "@/components/vitals/VitalsForm";
import { VitalsDisplay } from "@/components/vitals/VitalsDisplay";
import { OwnershipBanner } from "@/components/visit/OwnershipBanner";
import { ReviewFeedbackBanner } from "@/components/soap/ReviewFeedbackBanner";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/api";
import { useCurrentPhysician } from "@/hooks/useCurrentPhysician";
import type { Session, AuditEvent, SoapNote, Vitals } from "@/lib/types";

const FORBIDDEN_TOAST = "You can only modify sessions you created.";
function isForbiddenError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("API 403");
}
import { CheckCircle, FileText, ClipboardList, Loader2, AlertCircle, RefreshCw, Activity, Archive, RotateCcw } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActiveVisitPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { get, post, put } = useApi();
  const { showToast } = useToast();
  const currentPhysician = useCurrentPhysician();

  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [assignReviewOpen, setAssignReviewOpen] = useState(false);
  const [returningToDraft, setReturningToDraft] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [generatingSoap, setGeneratingSoap] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [soapError, setSoapError] = useState<string | null>(null);
  // Local edits to SOAP content (before saving)
  const [soapEdits, setSoapEdits] = useState<SoapContent | null>(null);
  // Vitals: show the form initially (or when user clicks Edit), otherwise display
  const [editingVitals, setEditingVitals] = useState(false);
  // Track last uploaded session for retry
  const [lastUploadedSession, setLastUploadedSession] = useState<Session | null>(null);

  const fetchAuditEvents = useCallback(async () => {
    if (!id) return;
    try {
      const events = await get<AuditEvent[]>(`/sessions/${id}/audit-events`);
      setAuditEvents(events);
    } catch {
      // silently ignore — timeline will show stale events
    }
  }, [get, id]);

  const fetchSession = useCallback(async () => {
    if (!id) return;
    try {
      const s = await get<Session>(`/sessions/${id}`);
      setSession(s);
      if (s?.auditEvents) setAuditEvents(s.auditEvents);
    } catch {
      // session not found — leave null
    } finally {
      setLoading(false);
    }
  }, [get, id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const runTranscription = useCallback(
    async (uploadedSession: Session) => {
      if (!id) return;
      setTranscribing(true);
      setTranscriptionError(null);
      setSoapError(null);
      try {
        const transcribed = await post<Session>(`/sessions/${id}/transcribe`);
        setSession(transcribed);
        if (transcribed?.auditEvents) setAuditEvents(transcribed.auditEvents);
      } catch (err) {
        if (isForbiddenError(err)) {
          showToast(FORBIDDEN_TOAST, "error");
        } else {
          setTranscriptionError("Transcription failed. Please try again.");
          setSession(uploadedSession);
          showToast("Transcription failed", "error");
        }
      } finally {
        setTranscribing(false);
      }
    },
    [post, id, showToast]
  );

  const handleUploadComplete = useCallback(
    async (uploaded: Session) => {
      setSession(uploaded);
      setLastUploadedSession(uploaded);
      await runTranscription(uploaded);
    },
    [runTranscription]
  );

  const handleRetryTranscription = useCallback(() => {
    if (lastUploadedSession) {
      runTranscription(lastUploadedSession);
    }
  }, [lastUploadedSession, runTranscription]);

  // Sync local soap edits when session soap note changes
  useEffect(() => {
    if (session?.soapNote) {
      setSoapEdits({
        subjective: session.soapNote.subjective,
        objective: session.soapNote.objective,
        assessment: session.soapNote.assessment,
        plan: session.soapNote.plan,
      });
    }
  }, [session?.soapNote?.id]);

  const handleVitalsSaved = useCallback((v: Vitals) => {
    setSession((prev) => (prev ? { ...prev, vitals: v } : prev));
    setEditingVitals(false);
    fetchAuditEvents();
  }, [fetchAuditEvents]);

  const handleSoapChange = useCallback((field: keyof SoapContent, value: string) => {
    setSoapEdits((prev) => (prev ? { ...prev, [field]: value } : null));
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (!id || !soapEdits) return;
    setSavingDraft(true);
    try {
      const updated = await put<SoapNote>(`/sessions/${id}/soap-note`, soapEdits);
      setSession((prev) => (prev ? { ...prev, soapNote: updated } : prev));
      showToast("Draft saved successfully");
      fetchAuditEvents();
    } catch (err) {
      showToast(
        isForbiddenError(err) ? FORBIDDEN_TOAST : "Failed to save draft",
        "error"
      );
    } finally {
      setSavingDraft(false);
    }
  }, [id, soapEdits, put, showToast, fetchAuditEvents]);

  const handleApprove = useCallback(async () => {
    if (!id) return;
    try {
      const updated = await post<SoapNote>(`/sessions/${id}/soap-note/approve`);
      setSession((prev) =>
        prev ? { ...prev, status: "COMPLETED", soapNote: updated } : prev
      );
      showToast("SOAP note approved and finalized");
      fetchAuditEvents();
    } catch (err) {
      showToast(
        isForbiddenError(err) ? FORBIDDEN_TOAST : "Failed to approve note",
        "error"
      );
    }
  }, [id, post, showToast, fetchAuditEvents]);

  const handleAssigned = useCallback(
    (updated: SoapNote) => {
      setAssignReviewOpen(false);
      setSession((prev) => (prev ? { ...prev, soapNote: updated } : prev));
      fetchAuditEvents();
    },
    [fetchAuditEvents]
  );

  const handleReturnToDraft = useCallback(
    async (feedback: string) => {
      if (!id || returningToDraft) return;
      setReturningToDraft(true);
      try {
        const updated = await post<SoapNote>(
          `/sessions/${id}/soap-note/return-to-draft`,
          { feedback }
        );
        setSession((prev) => (prev ? { ...prev, soapNote: updated } : prev));
        const ownerName = session?.physician?.fullName;
        showToast(
          ownerName
            ? `Note returned to ${ownerName} for revision`
            : "Note returned to draft"
        );
        fetchAuditEvents();
      } catch (err) {
        showToast(
          isForbiddenError(err) ? FORBIDDEN_TOAST : "Failed to return note",
          "error"
        );
      } finally {
        setReturningToDraft(false);
      }
    },
    [id, returningToDraft, post, session?.physician?.fullName, showToast, fetchAuditEvents]
  );

  const handleConfirmArchive = useCallback(async () => {
    if (!id || archiving) return;
    setArchiving(true);
    try {
      await post<Session>(`/sessions/${id}/archive`);
      setArchiveConfirmOpen(false);
      showToast("Visit archived");
      navigate("/visits");
    } catch (err) {
      showToast(
        isForbiddenError(err) ? FORBIDDEN_TOAST : "Failed to archive visit",
        "error"
      );
    } finally {
      setArchiving(false);
    }
  }, [id, archiving, post, showToast, navigate]);

  const handleUnarchiveVisit = useCallback(async () => {
    if (!id || archiving) return;
    setArchiving(true);
    try {
      const updated = await post<Session>(`/sessions/${id}/unarchive`);
      setSession((prev) => (prev ? { ...prev, ...updated } : updated));
      showToast("Visit restored");
      fetchAuditEvents();
    } catch (err) {
      showToast(
        isForbiddenError(err) ? FORBIDDEN_TOAST : "Failed to restore visit",
        "error"
      );
    } finally {
      setArchiving(false);
    }
  }, [id, archiving, post, showToast, fetchAuditEvents]);

  // Parse utterances from session transcript if present
  const utterances: Utterance[] = (() => {
    const raw = session?.transcript?.rawDiarizedText;
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Utterance[];
    } catch {
      return [];
    }
  })();

  const isApproved = session?.soapNote?.workflowStatus === "APPROVED";
  const isArchived = !!session?.archivedAt;
  // Optimistic: until we know the current physician isn't the owner,
  // assume they can edit. This avoids briefly flashing read-only mode for
  // owners while /auth/me is in flight. Non-owners get the full read-only
  // treatment once the lookup resolves, and the backend 403s any stray writes.
  const knownNonOwner =
    !!currentPhysician && !!session && currentPhysician.id !== session.physicianId;
  const isOwner = !knownNonOwner;
  // Assigned reviewer is resolved deterministically from the SOAP note relation.
  const isAssignedReviewer =
    !!currentPhysician &&
    !!session?.soapNote?.assignedReviewer &&
    currentPhysician.id === session.soapNote.assignedReviewer.id;
  // The banner is shown to any non-owner. Its copy adapts: assigned reviewers
  // get "You are reviewing this note."; uninvolved physicians get the
  // "viewing in read-only mode" language.
  const showOwnershipBanner = knownNonOwner;
  const assignedReviewerName = session?.soapNote?.assignedReviewer?.fullName ?? null;
  const reviewFeedback =
    session?.soapNote?.workflowStatus === "DRAFT"
      ? session?.soapNote?.reviewFeedback ?? null
      : null;

  const rightPanel = (
    <AuditTimeline events={auditEvents} />
  );

  if (loading) {
    return (
      <AppLayout title="Active Visit" rightPanel={rightPanel}>
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Active Visit" rightPanel={rightPanel}>
      <div className="px-6 py-6 space-y-6 max-w-3xl mx-auto">
        <PageHeader
          title={session?.patient?.fullName ?? "Unknown Patient"}
          backTo="history"
          backLabel="Back"
        >
          {session?.status && <StatusBadge status={session.status} />}
          {isOwner && session && (
            isArchived ? (
              <button
                type="button"
                onClick={handleUnarchiveVisit}
                disabled={archiving}
                data-testid="visit-unarchive-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                {archiving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Unarchive Visit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setArchiveConfirmOpen(true)}
                data-testid="visit-archive-btn"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-md transition-colors"
              >
                <Archive className="w-4 h-4" />
                Archive Visit
              </button>
            )
          )}
        </PageHeader>

        {isArchived && (
          <div
            data-testid="visit-archived-banner"
            className="-mt-2 inline-flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-3 py-1"
          >
            <Archive className="w-3.5 h-3.5" />
            Archived — hidden from visit lists
          </div>
        )}

        <ConfirmDialog
          open={archiveConfirmOpen}
          title="Archive this visit?"
          message="Are you sure you want to archive this visit? It will be hidden from all visit lists but the data will be preserved."
          confirmLabel={archiving ? "Archiving…" : "Archive Visit"}
          confirmClassName="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 disabled:opacity-50"
          onConfirm={handleConfirmArchive}
          onCancel={() => setArchiveConfirmOpen(false)}
        />
        <p className="-mt-3 text-sm text-slate-500">
          {session?.recordedAt ? formatDate(session.recordedAt) : "—"}
        </p>

        {showOwnershipBanner && session?.physician && (
          <OwnershipBanner
            physicianName={session.physician.fullName}
            asAssignedReviewer={isAssignedReviewer}
          />
        )}

        {/* Vitals panel */}
        {id && (
          <section
            data-testid="vitals-section"
            className="bg-white rounded-lg border border-slate-200 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">Vitals</h3>
            </div>
            {!isOwner ? (
              session?.vitals ? (
                <VitalsDisplay vitals={session.vitals} />
              ) : (
                <p
                  data-testid="vitals-empty-readonly"
                  className="text-sm text-slate-500"
                >
                  No vitals recorded.
                </p>
              )
            ) : session?.vitals && !editingVitals ? (
              <VitalsDisplay
                vitals={session.vitals}
                onEdit={() => setEditingVitals(true)}
              />
            ) : (
              <VitalsForm
                sessionId={id}
                initial={session?.vitals ?? null}
                onSaved={handleVitalsSaved}
                onCancel={
                  session?.vitals ? () => setEditingVitals(false) : undefined
                }
              />
            )}
          </section>
        )}

        {/* Audio recorder panel */}
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 text-slate-500 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-700">
              Audio Recording
            </h3>
          </div>
          {id ? (
            <AudioRecorder
              sessionId={id}
              onUploadComplete={handleUploadComplete}
              readOnly={!isOwner}
            />
          ) : (
            <p className="text-sm text-slate-400">No session ID.</p>
          )}
        </section>

        {/* Transcript panel */}
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">Transcript</h3>
          </div>
          {transcriptionError ? (
            <div
              className="flex flex-col items-center justify-center py-8 gap-3 text-center"
              data-testid="transcript-error"
            >
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-slate-600">{transcriptionError}</p>
              <button
                onClick={handleRetryTranscription}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Transcription
              </button>
            </div>
          ) : (
            <TranscriptViewer utterances={utterances} loading={transcribing} />
          )}
        </section>

        {/* Review feedback banner — shown while the note is DRAFT and carries
            feedback from the assigned reviewer. Visible to anyone viewing
            the visit; the owner is the primary audience. */}
        {reviewFeedback && (
          <ReviewFeedbackBanner
            reviewerName={assignedReviewerName}
            feedback={reviewFeedback}
          />
        )}

        {/* SOAP note panel */}
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">SOAP Note</h3>
            </div>
            {isApproved && session?.soapNote?.approvedAt && (
              <div
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1"
                data-testid="soap-approved-badge"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>
                  Approved{session.soapNote.approvedBy
                    ? ` by ${session.soapNote.approvedBy.fullName}`
                    : ""}
                  {" · "}
                  {new Date(session.soapNote.approvedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
          {soapError && !session?.soapNote ? (
            <div
              className="flex flex-col items-center justify-center py-8 gap-3 text-center"
              data-testid="soap-error"
            >
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-slate-600">{soapError}</p>
              {id && (
                <button
                  onClick={async () => {
                    setSoapError(null);
                    setGeneratingSoap(true);
                    try {
                      const updated = await post<Session>(`/sessions/${id}/generate-soap`);
                      setSession(updated);
                      if (updated?.auditEvents) setAuditEvents(updated.auditEvents);
                    } catch {
                      setSoapError("SOAP generation failed. Please try again.");
                      showToast("SOAP generation failed", "error");
                    } finally {
                      setGeneratingSoap(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry SOAP Generation
                </button>
              )}
            </div>
          ) : (
            <SoapNoteEditor
              note={soapEdits}
              loading={generatingSoap || transcribing}
              readOnly={isApproved || !isOwner}
              onChange={handleSoapChange}
            />
          )}
        </section>

        {/* Workflow action buttons */}
        {session?.soapNote && (isOwner || isAssignedReviewer) && (
          <SoapWorkflowActions
            workflowStatus={session.soapNote.workflowStatus}
            isOwner={isOwner}
            isAssignedReviewer={isAssignedReviewer}
            assignedReviewerName={assignedReviewerName}
            saving={savingDraft}
            returning={returningToDraft}
            onSaveDraft={handleSaveDraft}
            onApprove={handleApprove}
            onAssignForReview={() => setAssignReviewOpen(true)}
            onReturnToDraft={handleReturnToDraft}
          />
        )}

        {id && (
          <AssignReviewDialog
            open={assignReviewOpen}
            sessionId={id}
            currentPhysicianId={currentPhysician?.id ?? null}
            onCancel={() => setAssignReviewOpen(false)}
            onAssigned={handleAssigned}
          />
        )}
      </div>
    </AppLayout>
  );
}
