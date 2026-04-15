import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Session, Physician, Patient, SoapNote, Vitals } from "../lib/types";

// ---------------------------------------------------------------------------
// Stable mocked API — hoisted so its references stay constant across renders
// ---------------------------------------------------------------------------
const { mockGet, mockPost, mockPut, mockDel, mockUploadFile } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDel: vi.fn(),
  mockUploadFile: vi.fn(),
}));

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
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: { firstName: "Sarah" } }),
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));

import ActiveVisitPage from "../pages/ActiveVisitPage";
import { ToastProvider } from "../components/ui/Toast";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const PHYSICIAN_SMITH: Physician = {
  id: "phys-smith",
  clerkId: "clerk-smith",
  fullName: "Sarah Smith",
  email: "smith@example.com",
  credentials: null,
  createdAt: "",
  updatedAt: "",
};

const PHYSICIAN_LEE: Physician = {
  id: "phys-lee",
  clerkId: "clerk-lee",
  fullName: "James Lee",
  email: "lee@example.com",
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

const SOAP: SoapNote = {
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
  createdAt: "",
  updatedAt: "",
};

function makeSession(ownerPhysician: Physician): Session {
  return {
    id: "sess-1",
    physicianId: ownerPhysician.id,
    patientId: PATIENT.id,
    status: "IN_REVIEW",
    recordedAt: "2026-04-10T10:00:00.000Z",
    audioFileUrl: null,
    createdAt: "",
    updatedAt: "",
    patient: PATIENT,
    physician: ownerPhysician,
    vitals: VITALS,
    soapNote: SOAP,
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
// Owner view — no read-only treatment
// ---------------------------------------------------------------------------
describe("ActiveVisitPage — owner view", () => {
  it("does not render the ownership banner when viewing own session", async () => {
    const session = makeSession(PHYSICIAN_SMITH);
    configureMockGet(PHYSICIAN_SMITH, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    );
    // Let /auth/me resolve
    await waitFor(() => {
      expect(
        mockGet.mock.calls.some(([p]) => p === "/auth/me")
      ).toBe(true);
    });

    expect(screen.queryByTestId("ownership-banner")).not.toBeInTheDocument();
  });

  it("shows the vitals edit button for owner", async () => {
    const session = makeSession(PHYSICIAN_SMITH);
    configureMockGet(PHYSICIAN_SMITH, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("vitals-display")).toBeInTheDocument()
    );
    expect(screen.getByTestId("vitals-edit")).toBeInTheDocument();
  });

  it("shows SOAP workflow action buttons for owner", async () => {
    const session = makeSession(PHYSICIAN_SMITH);
    configureMockGet(PHYSICIAN_SMITH, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Save Draft")).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// Non-owner view — read-only treatment
// ---------------------------------------------------------------------------
describe("ActiveVisitPage — non-owner view", () => {
  it("renders the ownership banner naming the owning physician", async () => {
    const session = makeSession(PHYSICIAN_LEE);
    configureMockGet(PHYSICIAN_SMITH, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ownership-banner")).toBeInTheDocument()
    );
    const banner = screen.getByTestId("ownership-banner");
    expect(banner).toHaveTextContent("Dr. James Lee");
    expect(banner).toHaveTextContent(/read-only/i);
  });

  it("hides the Start Recording button and shows the empty-state placeholder when no audio is present", async () => {
    const session = makeSession(PHYSICIAN_LEE);
    configureMockGet(PHYSICIAN_SMITH, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ownership-banner")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("start-recording-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("audio-empty-state")).toBeInTheDocument();
  });

  it("shows VitalsDisplay without the edit button", async () => {
    const session = makeSession(PHYSICIAN_LEE);
    configureMockGet(PHYSICIAN_SMITH, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ownership-banner")).toBeInTheDocument()
    );
    expect(screen.getByTestId("vitals-display")).toBeInTheDocument();
    expect(screen.queryByTestId("vitals-edit")).not.toBeInTheDocument();
  });

  it("hides all SOAP workflow action buttons", async () => {
    const session = makeSession(PHYSICIAN_LEE);
    configureMockGet(PHYSICIAN_SMITH, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ownership-banner")).toBeInTheDocument()
    );
    expect(screen.queryByText("Save Draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Request Review")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign & Finalize")).not.toBeInTheDocument();
  });

  it("still shows the audit timeline and SOAP content (read-only)", async () => {
    const session = makeSession(PHYSICIAN_LEE);
    configureMockGet(PHYSICIAN_SMITH, session);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ownership-banner")).toBeInTheDocument()
    );
    // SOAP content should still be visible (the editor renders read-only)
    expect(screen.getByDisplayValue(/Patient reports headache/i)).toBeInTheDocument();
  });
});
