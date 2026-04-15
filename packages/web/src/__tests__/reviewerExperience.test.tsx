import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type {
  Session,
  Physician,
  Patient,
  SoapNote,
  Vitals,
  WorkflowStatus,
} from "../lib/types";
import { ReviewFeedbackBanner } from "../components/soap/ReviewFeedbackBanner";

// ---------------------------------------------------------------------------
// Hoisted API mocks so ActiveVisitPage's useApi hook is stable across renders
// ---------------------------------------------------------------------------
const { mockGet, mockPost, mockPut, mockDel, mockUploadFile } = vi.hoisted(
  () => ({
    mockGet: vi.fn(),
    mockPost: vi.fn(),
    mockPut: vi.fn(),
    mockDel: vi.fn(),
    mockUploadFile: vi.fn(),
  })
);

vi.mock("@/lib/api", () => ({
  useApi: () => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    del: mockDel,
    uploadFile: mockUploadFile,
  }),
}));

vi.mock("@clerk/clerk-react", () => ({
  UserButton: () => <button data-testid="user-button">User</button>,
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { firstName: "Robin" },
  }),
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));

import ActiveVisitPage from "../pages/ActiveVisitPage";
import { ToastProvider } from "../components/ui/Toast";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const OWNER: Physician = {
  id: "phys-owner",
  clerkId: "clerk-owner",
  fullName: "James Lee",
  email: "lee@example.com",
  credentials: null,
  createdAt: "",
  updatedAt: "",
};

const REVIEWER: Physician = {
  id: "phys-reviewer",
  clerkId: "clerk-reviewer",
  fullName: "Robin Chen",
  email: "chen@example.com",
  credentials: null,
  createdAt: "",
  updatedAt: "",
};

const UNRELATED: Physician = {
  id: "phys-other",
  clerkId: "clerk-other",
  fullName: "Pat Morgan",
  email: "morgan@example.com",
  credentials: null,
  createdAt: "",
  updatedAt: "",
};

const PATIENT: Patient = {
  id: "pat-1",
  fullName: "Jane Doe",
  dateOfBirth: null,
  mrn: null,
  sex: null,
  heightCm: null,
  eyeColor: null,
  bloodType: null,
  createdAt: "",
  updatedAt: "",
};

const VITALS: Vitals = {
  id: "vit-1",
  sessionId: "sess-1",
  weightKg: 70,
  bloodPressureSys: 120,
  bloodPressureDia: 80,
  heartRate: 72,
  temperatureC: 36.8,
  respiratoryRate: 14,
  oxygenSaturation: 98,
  recordedAt: "",
};

function makeSoap(overrides: Partial<SoapNote> = {}): SoapNote {
  return {
    id: "soap-1",
    sessionId: "sess-1",
    subjective: "Patient reports headache",
    objective: "BP 120/80",
    assessment: "Tension headache",
    plan: "Ibuprofen PRN",
    workflowStatus: "DRAFT",
    approvedAt: null,
    approvedById: null,
    approvedBy: null,
    assignedReviewerId: null,
    assignedReviewer: null,
    reviewFeedback: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function makeSession(soap: SoapNote): Session {
  return {
    id: "sess-1",
    physicianId: OWNER.id,
    patientId: PATIENT.id,
    status: "IN_REVIEW",
    recordedAt: "2026-04-10T10:00:00.000Z",
    audioFileUrl: null,
    createdAt: "",
    updatedAt: "",
    patient: PATIENT,
    physician: OWNER,
    vitals: VITALS,
    soapNote: soap,
    auditEvents: [],
  };
}

function configureMockGet(currentUser: Physician, session: Session) {
  mockGet.mockImplementation((path: string) => {
    if (path === "/auth/me") return Promise.resolve(currentUser);
    if (path === `/sessions/${session.id}`) return Promise.resolve(session);
    if (path === `/sessions/${session.id}/audit-events`)
      return Promise.resolve([]);
    return Promise.resolve(null);
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/visit/sess-1"]}>
      <ToastProvider>
        <Routes>
          <Route path="/visit/:id" element={<ActiveVisitPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDel.mockReset();
  mockUploadFile.mockReset();
});

// ---------------------------------------------------------------------------
// ReviewFeedbackBanner — standalone rendering
// ---------------------------------------------------------------------------
describe("ReviewFeedbackBanner", () => {
  it("renders the reviewer name and feedback text", () => {
    render(
      <ReviewFeedbackBanner
        reviewerName="Robin Chen"
        feedback="Please clarify the assessment — consider ruling out pneumonia."
      />
    );
    const banner = screen.getByTestId("review-feedback-banner");
    expect(banner).toHaveTextContent(
      "Dr. Robin Chen returned this note for revision:"
    );
    expect(screen.getByTestId("review-feedback-banner-body")).toHaveTextContent(
      /ruling out pneumonia/i
    );
  });

  it("falls back to a generic heading when reviewer name is missing", () => {
    render(
      <ReviewFeedbackBanner reviewerName={null} feedback="Needs more detail." />
    );
    expect(
      screen.getByTestId("review-feedback-banner-heading")
    ).toHaveTextContent(/assigned reviewer returned this note/i);
  });
});

// ---------------------------------------------------------------------------
// ActiveVisitPage — feedback banner visibility rules
// ---------------------------------------------------------------------------
describe("ActiveVisitPage — review feedback banner", () => {
  it("renders the banner when the DRAFT note carries reviewFeedback", async () => {
    const soap = makeSoap({
      workflowStatus: "DRAFT",
      assignedReviewerId: REVIEWER.id,
      assignedReviewer: { id: REVIEWER.id, fullName: REVIEWER.fullName },
      reviewFeedback: "Please expand the assessment section.",
    });
    const session = makeSession(soap);
    configureMockGet(OWNER, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("review-feedback-banner")).toBeInTheDocument()
    );
    const banner = screen.getByTestId("review-feedback-banner");
    expect(banner).toHaveTextContent("Dr. Robin Chen");
    expect(banner).toHaveTextContent(/expand the assessment section/i);
  });

  it("does not render the banner when reviewFeedback is null", async () => {
    const soap = makeSoap({ workflowStatus: "DRAFT", reviewFeedback: null });
    const session = makeSession(soap);
    configureMockGet(OWNER, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    );
    expect(
      screen.queryByTestId("review-feedback-banner")
    ).not.toBeInTheDocument();
  });

  it.each<WorkflowStatus>(["PENDING_REVIEW", "APPROVED"])(
    "does not render the banner when status is %s even with feedback",
    async (status) => {
      const soap = makeSoap({
        workflowStatus: status,
        assignedReviewerId: REVIEWER.id,
        assignedReviewer: { id: REVIEWER.id, fullName: REVIEWER.fullName },
        reviewFeedback: "Legacy feedback from a previous cycle.",
      });
      const session = makeSession(soap);
      configureMockGet(OWNER, session);

      renderPage();

      await waitFor(() =>
        expect(screen.getByText("Jane Doe")).toBeInTheDocument()
      );
      expect(
        screen.queryByTestId("review-feedback-banner")
      ).not.toBeInTheDocument();
    }
  );
});

// ---------------------------------------------------------------------------
// ActiveVisitPage — assigned reviewer view
// ---------------------------------------------------------------------------
describe("ActiveVisitPage — assigned reviewer view", () => {
  it("shows the ownership banner with 'reviewing this note' language", async () => {
    const soap = makeSoap({
      workflowStatus: "PENDING_REVIEW",
      assignedReviewerId: REVIEWER.id,
      assignedReviewer: { id: REVIEWER.id, fullName: REVIEWER.fullName },
    });
    const session = makeSession(soap);
    configureMockGet(REVIEWER, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ownership-banner")).toBeInTheDocument()
    );
    const banner = screen.getByTestId("ownership-banner");
    expect(banner).toHaveAttribute("data-variant", "reviewer");
    expect(banner).toHaveTextContent("Dr. James Lee");
    expect(banner).toHaveTextContent(/reviewing this note/i);
    expect(banner).not.toHaveTextContent(/read-only/i);
  });

  it("renders the SOAP content as read-only for the reviewer", async () => {
    const soap = makeSoap({
      workflowStatus: "PENDING_REVIEW",
      assignedReviewerId: REVIEWER.id,
      assignedReviewer: { id: REVIEWER.id, fullName: REVIEWER.fullName },
    });
    const session = makeSession(soap);
    configureMockGet(REVIEWER, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ownership-banner")).toBeInTheDocument()
    );

    // SOAP content is present but not editable.
    const subjective = screen.getByDisplayValue(/Patient reports headache/i);
    expect(subjective).toHaveAttribute("readonly");

    // Reviewer never sees Save Draft / Sign & Finalize / Assign for Review.
    expect(screen.queryByTestId("btn-save-draft")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-sign-finalize")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-assign-review")).not.toBeInTheDocument();

    // Reviewer DOES see Approve & Sign + Return to Draft.
    expect(screen.getByTestId("btn-reviewer-approve")).toBeInTheDocument();
    expect(screen.getByTestId("btn-return-to-draft")).toBeInTheDocument();
  });

  it("shows the uninvolved physician the classic read-only banner", async () => {
    const soap = makeSoap({
      workflowStatus: "PENDING_REVIEW",
      assignedReviewerId: REVIEWER.id,
      assignedReviewer: { id: REVIEWER.id, fullName: REVIEWER.fullName },
    });
    const session = makeSession(soap);
    configureMockGet(UNRELATED, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ownership-banner")).toBeInTheDocument()
    );
    const banner = screen.getByTestId("ownership-banner");
    expect(banner).toHaveAttribute("data-variant", "read-only");
    expect(banner).toHaveTextContent(/read-only/i);
  });
});
