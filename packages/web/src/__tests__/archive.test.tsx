import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Patient, Session, Physician, SoapNote, Vitals } from "../lib/types";

const { mockGet, mockPost, mockPut, mockDel, mockUploadFile, mockNavigate } =
  vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockPost: vi.fn(),
    mockPut: vi.fn(),
    mockDel: vi.fn(),
    mockUploadFile: vi.fn(),
    mockNavigate: vi.fn(),
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import PatientListPage from "../pages/PatientListPage";
import PatientDetailPage from "../pages/PatientDetailPage";
import PastVisitsPage from "../pages/PastVisitsPage";
import ActiveVisitPage from "../pages/ActiveVisitPage";
import { ToastProvider } from "../components/ui/Toast";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------
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

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "patient-1",
    fullName: "Alice Example",
    dateOfBirth: "1990-05-15T00:00:00.000Z",
    mrn: "MRN-001",
    sex: null,
    heightCm: null,
    eyeColor: null,
    bloodType: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    _count: { allergies: 0, medications: 0, sessions: 0 },
    allergies: [],
    medications: [],
    sessions: [],
    ...overrides,
  };
}

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
  subjective: "S",
  objective: "O",
  assessment: "A",
  plan: "P",
  workflowStatus: "DRAFT",
  approvedAt: null,
  approvedById: null,
  approvedBy: null,
  createdAt: "",
  updatedAt: "",
};

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    physicianId: PHYSICIAN_SMITH.id,
    patientId: "patient-1",
    status: "IN_REVIEW",
    recordedAt: "2026-04-10T10:00:00.000Z",
    audioFileUrl: null,
    createdAt: "",
    updatedAt: "",
    patient: makePatient(),
    physician: PHYSICIAN_SMITH,
    vitals: VITALS,
    soapNote: SOAP,
    auditEvents: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDel.mockReset();
  mockUploadFile.mockReset();
  mockNavigate.mockReset();
});

// --------------------------------------------------------------------------
// PatientListPage — Show Archived toggle
// --------------------------------------------------------------------------
describe("PatientListPage — archive toggle", () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/patients"]}>
        <ToastProvider>
          <PatientListPage />
        </ToastProvider>
      </MemoryRouter>
    );
  }

  it("refetches with includeArchived=true when toggle is enabled", async () => {
    mockGet.mockResolvedValue([]);
    const user = userEvent.setup();

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/patients");
    });

    await user.click(screen.getByTestId("patient-show-archived-toggle"));

    await waitFor(
      () => {
        expect(mockGet).toHaveBeenCalledWith("/patients?includeArchived=true");
      },
      { timeout: 2000 }
    );
  });

  it("renders archived patients with a badge + unarchive button when toggle is on", async () => {
    mockGet.mockResolvedValue([
      makePatient({
        id: "archived-1",
        fullName: "Archived Alice",
        archivedAt: "2026-01-15T00:00:00.000Z",
      }),
    ]);

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByText("Archived Alice")).toBeInTheDocument();
    });

    expect(screen.getByTestId("patient-card-archived-badge")).toBeInTheDocument();
    expect(screen.getByTestId("patient-card-unarchive")).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// PatientDetailPage — archive confirmation dialog
// --------------------------------------------------------------------------
describe("PatientDetailPage — archive action", () => {
  function renderPage(patientId = "patient-1") {
    return render(
      <MemoryRouter initialEntries={[`/patients/${patientId}`]}>
        <ToastProvider>
          <Routes>
            <Route path="/patients/:id" element={<PatientDetailPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );
  }

  it("opens the confirmation dialog when Archive Patient is clicked", async () => {
    mockGet.mockResolvedValue(makePatient());
    const user = userEvent.setup();

    await act(async () => {
      renderPage();
    });

    await waitFor(() =>
      expect(screen.getByTestId("patient-archive-btn")).toBeInTheDocument()
    );

    await user.click(screen.getByTestId("patient-archive-btn"));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText(/Archive this patient/i)).toBeInTheDocument();
  });

  it("calls POST /archive and navigates back to /patients on confirm", async () => {
    mockGet.mockResolvedValue(makePatient());
    mockPost.mockResolvedValue(makePatient({ archivedAt: "2026-04-15" }));
    const user = userEvent.setup();

    await act(async () => {
      renderPage();
    });

    await waitFor(() =>
      expect(screen.getByTestId("patient-archive-btn")).toBeInTheDocument()
    );

    await user.click(screen.getByTestId("patient-archive-btn"));
    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/patients/patient-1/archive");
      expect(mockNavigate).toHaveBeenCalledWith("/patients");
    });
  });

  it("shows the Unarchive Patient button + archived banner when patient is archived", async () => {
    mockGet.mockResolvedValue(
      makePatient({ archivedAt: "2026-01-15T00:00:00.000Z" })
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() =>
      expect(screen.getByTestId("patient-unarchive-btn")).toBeInTheDocument()
    );
    expect(screen.getByTestId("patient-archived-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("patient-archive-btn")).not.toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// PastVisitsPage — Include Archived toggle + owner-aware unarchive
// --------------------------------------------------------------------------
describe("PastVisitsPage — archive toggle", () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/visits"]}>
        <ToastProvider>
          <PastVisitsPage />
        </ToastProvider>
      </MemoryRouter>
    );
  }

  it("refetches with includeArchived=true when toggle is enabled", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/auth/me") return Promise.resolve(PHYSICIAN_SMITH);
      if (path === "/physicians") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const user = userEvent.setup();

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(
        mockGet.mock.calls.some(([p]) => p === "/sessions?scope=all")
      ).toBe(true);
    });

    await user.click(screen.getByTestId("visit-include-archived-toggle"));

    await waitFor(
      () => {
        expect(
          mockGet.mock.calls.some(
            ([p]) => p === "/sessions?scope=all&includeArchived=true"
          )
        ).toBe(true);
      },
      { timeout: 2000 }
    );
  });

  it("shows unarchive button only on visits owned by the current physician", async () => {
    const ownedArchived = makeSession({
      id: "owned-arch",
      physicianId: PHYSICIAN_SMITH.id,
      archivedAt: "2026-04-01T00:00:00.000Z",
      status: "COMPLETED",
      physician: PHYSICIAN_SMITH,
    });
    const otherArchived = makeSession({
      id: "other-arch",
      physicianId: PHYSICIAN_LEE.id,
      archivedAt: "2026-04-01T00:00:00.000Z",
      status: "COMPLETED",
      physician: PHYSICIAN_LEE,
    });
    mockGet.mockImplementation((path: string) => {
      if (path === "/auth/me") return Promise.resolve(PHYSICIAN_SMITH);
      if (path === "/physicians") return Promise.resolve([]);
      if (path.startsWith("/sessions")) return Promise.resolve([ownedArchived, otherArchived]);
      return Promise.resolve([]);
    });
    const user = userEvent.setup();

    await act(async () => {
      renderPage();
    });

    // Toggle on so archived visits are fetched + rendered
    await user.click(screen.getByTestId("visit-include-archived-toggle"));

    await waitFor(() => {
      expect(screen.getAllByTestId("visit-card-archived-badge")).toHaveLength(2);
    });

    // Only the owned archived visit should expose the unarchive button
    const unarchiveButtons = screen.getAllByTestId("visit-card-unarchive");
    expect(unarchiveButtons).toHaveLength(1);
  });
});

// --------------------------------------------------------------------------
// ActiveVisitPage — owner-only Archive Visit action
// --------------------------------------------------------------------------
describe("ActiveVisitPage — archive action", () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/visits/sess-1"]}>
        <ToastProvider>
          <Routes>
            <Route path="/visits/:id" element={<ActiveVisitPage />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    );
  }

  function configureGet(currentUser: Physician, session: Session) {
    mockGet.mockImplementation((path: string) => {
      if (path === "/auth/me") return Promise.resolve(currentUser);
      if (path === `/sessions/${session.id}`) return Promise.resolve(session);
      if (path === `/sessions/${session.id}/audit-events`) return Promise.resolve([]);
      return Promise.resolve(null);
    });
  }

  it("shows the Archive Visit button for the owner", async () => {
    const session = makeSession({ physicianId: PHYSICIAN_SMITH.id, physician: PHYSICIAN_SMITH });
    configureGet(PHYSICIAN_SMITH, session);

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByTestId("visit-archive-btn")).toBeInTheDocument();
    });
  });

  it("hides the Archive Visit button for non-owners", async () => {
    const session = makeSession({ physicianId: PHYSICIAN_LEE.id, physician: PHYSICIAN_LEE });
    configureGet(PHYSICIAN_SMITH, session);

    await act(async () => {
      renderPage();
    });

    await waitFor(() =>
      expect(screen.getByTestId("ownership-banner")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("visit-archive-btn")).not.toBeInTheDocument();
  });

  it("opens the confirmation dialog and archives on confirm", async () => {
    const session = makeSession({ physicianId: PHYSICIAN_SMITH.id, physician: PHYSICIAN_SMITH });
    configureGet(PHYSICIAN_SMITH, session);
    mockPost.mockResolvedValue({ ...session, archivedAt: "2026-04-15" });
    const user = userEvent.setup();

    await act(async () => {
      renderPage();
    });

    await waitFor(() =>
      expect(screen.getByTestId("visit-archive-btn")).toBeInTheDocument()
    );

    await user.click(screen.getByTestId("visit-archive-btn"));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/sessions/sess-1/archive");
      expect(mockNavigate).toHaveBeenCalledWith("/visits");
    });
  });
});
