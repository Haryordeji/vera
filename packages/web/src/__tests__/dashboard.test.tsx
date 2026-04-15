import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Session, SessionStatus, Patient } from "../lib/types";

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
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { firstName: "Sarah" },
  }),
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));

import DashboardPage from "../pages/DashboardPage";
import { ActiveSessionCard } from "../components/visit/ActiveSessionCard";
import { ToastProvider } from "../components/ui/Toast";

const makePatient = (fullName: string): Patient => ({
  id: `pat-${fullName}`,
  fullName,
  dateOfBirth: null,
  mrn: null,
  sex: null,
  heightCm: null,
  eyeColor: null,
  bloodType: null,
  createdAt: "",
  updatedAt: "",
});

function makeSession(
  id: string,
  status: SessionStatus,
  recordedAt: string,
  patientName = "Jane Doe"
): Session {
  return {
    id,
    physicianId: "phys-1",
    patientId: `pat-${patientName}`,
    status,
    recordedAt,
    audioFileUrl: null,
    createdAt: recordedAt,
    updatedAt: recordedAt,
    patient: makePatient(patientName),
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <ToastProvider>
        <DashboardPage />
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

const NOW = new Date();
const ISO_NOW = NOW.toISOString();
const ISO_3_DAYS_AGO = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
const ISO_10_DAYS_AGO = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------
describe("DashboardPage", () => {
  it("fetches sessions with scope=mine", async () => {
    mockGet.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith("/sessions?scope=mine");
  });

  it("renders quick stats with correct counts", async () => {
    mockGet.mockResolvedValueOnce([
      makeSession("s1", "RECORDING", ISO_NOW),
      makeSession("s2", "TRANSCRIBING", ISO_NOW),
      makeSession("s3", "GENERATING_NOTE", ISO_NOW),
      makeSession("s4", "IN_REVIEW", ISO_NOW),
      makeSession("s5", "IN_REVIEW", ISO_NOW),
      makeSession("s6", "COMPLETED", ISO_3_DAYS_AGO), // within week
      makeSession("s7", "COMPLETED", ISO_3_DAYS_AGO), // within week
      makeSession("s8", "COMPLETED", ISO_10_DAYS_AGO), // older than a week
    ]);

    renderPage();

    // In Progress = RECORDING + TRANSCRIBING + GENERATING_NOTE = 3
    await waitFor(() =>
      expect(screen.getByTestId("stat-in-progress-value")).toHaveTextContent("3")
    );
    // Awaiting Review = IN_REVIEW count = 2
    expect(screen.getByTestId("stat-awaiting-review-value")).toHaveTextContent("2");
    // Completed This Week = 2 (third is older than 7 days)
    expect(screen.getByTestId("stat-completed-this-week-value")).toHaveTextContent("2");
  });

  it("only shows non-completed sessions in the active list", async () => {
    mockGet.mockResolvedValueOnce([
      makeSession("active-1", "RECORDING", ISO_NOW, "Alice"),
      makeSession("active-2", "IN_REVIEW", ISO_NOW, "Bob"),
      makeSession("done-1", "COMPLETED", ISO_NOW, "Carol"),
    ]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("active-sessions-list")).toBeInTheDocument()
    );

    const cards = screen.getAllByTestId("active-session-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Carol")).not.toBeInTheDocument();
  });

  it("renders empty state when there are no active sessions", async () => {
    mockGet.mockResolvedValueOnce([
      makeSession("c1", "COMPLETED", ISO_3_DAYS_AGO),
    ]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-empty-state")).toBeInTheDocument()
    );
    expect(screen.getByText(/No active sessions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view past visits/i })).toBeInTheDocument();
    // The active list wrapper should not render
    expect(screen.queryByTestId("active-sessions-list")).not.toBeInTheDocument();
  });

  it("renders the greeting with the user's first name", async () => {
    mockGet.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Good (morning|afternoon|evening), Sarah/)).toBeInTheDocument()
    );
  });

  it("renders the Start New Visit CTA button", async () => {
    mockGet.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: /start new visit/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// ActiveSessionCard — action-needed description per status
// ---------------------------------------------------------------------------
describe("ActiveSessionCard action-needed copy", () => {
  const cases: Array<[Exclude<SessionStatus, "COMPLETED">, string]> = [
    ["RECORDING", "Visit started, awaiting recording"],
    ["TRANSCRIBING", "Audio uploaded, transcription in progress"],
    ["GENERATING_NOTE", "Transcript ready, generating SOAP note"],
    ["IN_REVIEW", "SOAP note draft ready for review"],
  ];

  it.each(cases)("%s → %s", (status, expected) => {
    render(
      <MemoryRouter>
        <ActiveSessionCard
          session={makeSession(`${status}-id`, status, ISO_NOW, "Test Patient")}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByTestId("active-session-card")).toHaveAttribute(
      "data-status",
      status
    );
  });
});
